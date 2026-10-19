# Student Survey and Feedback System

A React frontend and an ASP.NET Core 8 backend over a SQL Server database (`SSS`),
restored from a backup file that is distributed separately from the source code.

- Frontend: React 18, React Router, i18next, Lucide icons, PWA support
- Backend: ASP.NET Core 8, Entity Framework Core 8, Swagger
- Database: SQL Server (LocalDB for local work, or SQL Server 2022 in Docker)

## Before you start

Get `SSS.bak` from the project owner and put it at **`new database/SSS.bak`**.
It is not in source control (`.gitignore` excludes `*.bak`), and nothing works
without it.

The file holds **seven appended backup sets**. Set 7 (2026-05-17) is the newest and
the one the code is written against; set 1 is an older, completely empty schema.
Both restore scripts therefore pass `WITH FILE = 7` explicitly — without it SQL
Server silently restores set 1 and you get an empty database.

## Running locally

There are two supported paths. They produce the same database; pick whichever
matches what you have installed.

### Option A: SQL Server LocalDB (no Docker)

Needs Node.js 20+, the .NET 8 SDK or runtime, and SQL Server LocalDB with `sqlcmd`
(both ship with SQL Server Express and with Visual Studio).

```bash
cp .env.example .env     # then set JWT_SIGNING_KEY to a long random string
npm ci
npm run db:restore
npm run db:hash-passwords
```

`npm run db:hash-passwords` replaces the plain-text passwords in the restored
backup with PBKDF2 hashes. The passwords themselves do not change, so you sign in
exactly as before. It is safe to re-run and only needs doing after a restore.

Then start the two servers in separate terminals:

```bash
npm run start:api
```

```bash
npm start
```

`npm run db:restore` starts the LocalDB instance, restores backup set 7 into the
`SSS` database and prints a row count per table. Re-running it replaces the local
database, which is the quickest way to undo test data.

### Option B: Docker

Needs Docker Desktop and Node.js 20+.

```bash
cp .env.example .env     # then set MSSQL_SA_PASSWORD to a strong password
docker compose up -d
npm ci
npm start
```

Compose starts SQL Server 2022, restores `new database/SSS.bak` into `SSS`,
verifies the result and runs the backend on port 5001.

### Checking it works

- Frontend: <http://localhost:3000>
- API health: <http://localhost:5001/api/health> — reports `status: "ok"` plus row counts
- Swagger: <http://localhost:5001/swagger>

A healthy restore reports 18 users, 6 surveys, 12 news items and 10 courses.

## Signing in

The accounts come from the backup, and their passwords were placeholder strings
stored in clear text. `npm run db:hash-passwords` hashes them in place without
changing what you type, so these are the logins. The page lists them under
"Quick role access".

| Role | Email | Password |
| --- | --- | --- |
| Admin | `arman.sargsyan@uni.am` | `hash_admin_1` |
| Lecturer | `gevorg.h@uni.am` | `hash_lect_1` |
| Student | `davit.h@student.uni.am` | `hash_stud_1` |

There are 18 accounts in total, following the same pattern (`hash_admin_2`,
`hash_lect_2`, `hash_stud_3`, and so on).

## Authentication and permissions

Login returns a signed JWT that the React app stores and sends as an
`Authorization: Bearer …` header on every call. Tokens last 12 hours; when one
expires or is rejected the app signs the user out rather than showing a shell it
cannot fill.

Passwords are hashed with ASP.NET Core's PBKDF2 hasher. A row still holding a
plain-text value is verified as text once and then rewritten as a hash, so the
database upgrades itself as people sign in even if the migration was skipped.

| Access | Endpoints |
| --- | --- |
| Anonymous | `/api/health`, login, register, password-reset check |
| Any signed-in user | Dashboard, news, survey list and detail, taking a survey, AI assistant |
| Admin or lecturer | Survey results, creating a survey |
| Self, or any admin | Reading and updating a user account |

Writes take the account id from the token, never from the request body, so a
signed-in user cannot create surveys or submit answers as somebody else. CORS is
limited to the origins in `CORS_ALLOWED_ORIGINS`.

### Abuse protection on the sign-in endpoints

Two independent limits guard `/api/auth/*`:

| Limit | Scope | Rule |
| --- | --- | --- |
| Rate limit | Per client IP | 10 requests per minute, then `429` with `Retry-After` |
| Account lockout | Per submitted email | 5 failed sign-ins within 15 minutes locks that address for 15 minutes |

The lockout counts attempts against whatever address was submitted, existing or
not, so a locked response says nothing about which accounts are real. A correct
password is still refused while the lockout holds. Lockout state is in memory, so
it resets when the backend restarts and is not shared between instances — a
multi-instance deployment needs a shared store.

Behind a reverse proxy the rate limit sees the proxy's address unless forwarded
headers are configured, which would apply one shared limit to all users.

### Password reset

Asking for a reset emails a link holding a single-use token that expires after 30
minutes; the link opens `/reset-password`, where the new password is chosen.

- Only the SHA-256 of a token is stored, in `dbo.PasswordResetToken`, so a copy of
  that table cannot be turned back into working links.
- Asking again invalidates the previous link, and redeeming one stamps `UsedAt` so
  it cannot be replayed.
- The request answers identically for a registered and an unregistered address,
  and a failure to send mail is logged rather than returned, so neither can be
  used to discover accounts.
- Every bad token - wrong, expired or already spent - gives the same answer.

**With `SMTP_HOST` unset the backend writes the link to its own console instead of
sending mail**, which is how the flow is used locally. Set the SMTP variables in
`.env` to deliver it for real.

That table is not in the backup, so `scripts/schema-password-reset-token.sql`
creates it. Both restore paths run it automatically; it is additive and
re-runnable.

Remaining security work is listed in [KNOWN_GAPS.md](KNOWN_GAPS.md).

## Configuration

`.env` at the repository root is read by the React dev server and, since the
backend loads it at startup, by the backend too. It is git-ignored.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `REACT_APP_API_BASE_URL` | frontend | Backend URL; `http://localhost:5001` locally |
| `JWT_SIGNING_KEY` | backend | Signs access tokens; at least 32 characters. Outside Development the backend refuses to start without it; in Development it generates a temporary one and warns |
| `CORS_ALLOWED_ORIGINS` | backend | Comma separated browser origins allowed to call the API; defaults to `http://localhost:3000` |
| `APP_BASE_URL` | backend | Front-end URL used to build the reset link; defaults to the first allowed CORS origin |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_SSL` | backend | Outgoing mail. With `SMTP_HOST` unset, mail is written to the backend log instead |
| `MSSQL_SA_PASSWORD` | Docker only | SA password for the SQL Server container |
| `OPENAI_API_KEY` | backend | Enables the AI assistant; without it the Chat page shows a clear "not configured" notice and everything else keeps working |
| `OPENAI_MODEL` | backend | Defaults to `gpt-4o-mini` |

The backend connection string comes from `ConnectionStrings__DefaultConnection`
when set (Docker does this), otherwise from `backend/appsettings.Development.json`,
which points at LocalDB.

## Database schema

The restored database does not match the names the original code used. The current
code follows the database.

| Table | Rows | What it holds |
| --- | --- | --- |
| `UserAccount` | 18 | Accounts; `StudentData` / `LecturerData` extend it |
| `Course`, `StudentCourse` | 10 / 36 | Courses and enrolment |
| `News`, `NewsType`, `NewsTargetRole` | 12 / 5 / 22 | News, categorised and targeted per role |
| `PasswordResetToken` | 0 | Reset tokens, stored hashed. Added by a script, not in the backup |
| `Survey`, `Question` | 6 / 12 | Survey definitions |
| `SurveySession`, `SurveyAnswer` | 16 / 32 | One session per response, one row per answer |
| `Chat`, `ChatMessage` | 12 / 26 | Student/admin support conversations |

`Chat` and `ChatMessage` were called `Survey` and `SurveyMessage` in the older
backup set — their primary keys are still named `PK__Survey__…`. The surveys the
app shows come from the real `Survey` table, not from `Chat`.

## API endpoints

| Method | Route | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | anonymous | Connectivity and row counts |
| `POST` | `/api/auth/login` | anonymous | Returns `{ token, expiresAt, user }` |
| `POST` | `/api/auth/register` | anonymous | Creates a Student account, min 8 character password |
| `POST` | `/api/auth/password-reset/request` | anonymous | Emails a reset link; neutral answer either way |
| `POST` | `/api/auth/password-reset/confirm` | anonymous | Redeems the token and sets the new password |
| `GET` | `/api/users/{id}` | self or admin | Account details |
| `PUT` | `/api/users/{id}` | self or admin | Updates profile, language and theme |
| `GET` | `/api/dashboard` | signed in | Totals and the five newest surveys |
| `GET` | `/api/surveys` | signed in | All surveys with question and response counts |
| `GET` | `/api/surveys/{id}` | signed in | One survey and its questions |
| `GET` | `/api/surveys/{id}/results` | admin, lecturer | Answer distribution per question |
| `POST` | `/api/surveys` | admin, lecturer | Creates a survey, owned by the caller |
| `POST` | `/api/surveys/{id}/responses` | signed in | Writes a session and its answers for the caller |
| `GET` | `/api/news?role=student` | signed in | News filtered to a role |
| `POST` | `/api/ai-assistant/chat` | signed in | 503 with a clear message when no API key is set |

## Repository layout

```
src/                      React app (pages, contexts, services)
backend/
  Controllers/            API controllers
  Models/                 EF Core entities, SssContext, UserPresentation
  Services/               Password hashing, JWT issuing, password migration
  Program.cs              Startup, auth, CORS, .env loading
scripts/
  restore-localdb.ps1     LocalDB restore entry point
  restore-localdb.sql     Restore for LocalDB (Windows paths)
  restore.sql             Restore for Docker (Linux paths)
  verify.sql              Confirms tables exist and reports row counts
  schema-password-reset-token.sql  Creates the reset token table (applied by both restores)
  migrate-question-text.sql   Optional schema fix - NOT APPLIED
new database/SSS.bak      The backup (not in source control)
```

## Deploying

The React build must not call `localhost`: on a phone or a hosting platform that
points at the user's own device. Deploy the backend first (see
[backend/Dockerfile](backend/Dockerfile)), then set `REACT_APP_API_BASE_URL` to its
public URL and rebuild the frontend.

The backend needs:

```bash
ConnectionStrings__DefaultConnection=Server=...;Database=SSS;User Id=...;Password=...;TrustServerCertificate=True;
JWT_SIGNING_KEY=<a long random string, kept secret>
CORS_ALLOWED_ORIGINS=https://your-frontend-domain
OPENAI_API_KEY=...
PORT=8080
```

Serve the API over HTTPS: the access token is a bearer credential and must not
travel in clear text. Read [KNOWN_GAPS.md](KNOWN_GAPS.md) for what is still open.
