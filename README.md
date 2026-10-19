# Student Survey and Feedback System

A React frontend and an ASP.NET Core 8 backend over a SQL Server database (`SSS`).

- Frontend: React 18, React Router, i18next, Lucide icons, PWA support
- Backend: ASP.NET Core 8, Entity Framework Core 8, Swagger
- Database: SQL Server (LocalDB for local work, or SQL Server 2022 in Docker)

## Before you start: pick a database path

There are two ways to get the `SSS` database, and they are kept strictly separate.

**Path 1 — restore the real backup.** The data the application was built on.
Get `SSS.bak` from the project owner and put it at **`new database/SSS.bak`**; it
is not in source control (`.gitignore` excludes `*.bak`).

The file holds **seven appended backup sets**. Set 7 (2026-05-17) is the newest and
the one the code is written against; set 1 is an older, completely empty schema.
Both restore scripts therefore pass `WITH FILE = 7` explicitly — without it SQL
Server silently restores set 1 and you get an empty database.

**Path 2 — seed synthetic data.** Needs nothing but this repository, so it works
where the backup is not available: a CI job, a container, a fresh clone.
[scripts/seed-dev-data.sql](scripts/seed-dev-data.sql) creates `SSS` from scratch
with the same schema set 7 produces and fills it with invented sample data of
comparable shape, so every page has something to show. The accounts, surveys, news
and conversations are all made up; see [Signing in](#signing-in) for the logins and
[KNOWN_GAPS.md](KNOWN_GAPS.md) for what the seeded data does not reproduce.

Both paths end with a database called `SSS`, and the rest of the setup is the same.
Either one **replaces** an existing `SSS`, so switching between them is just a
matter of running the other command.

## Running locally

Pick the row that matches what you have installed.

| | Real backup | Synthetic data |
| --- | --- | --- |
| LocalDB (no Docker) | `npm run db:restore` | `npm run db:seed` |
| Docker | `docker compose up -d` with `SSS.bak` in place | `docker compose up -d` with no backup |

### Option A: SQL Server LocalDB (no Docker)

Needs Node.js 20+, the .NET 8 SDK or runtime, and SQL Server LocalDB with `sqlcmd`
(both ship with SQL Server Express and with Visual Studio).

```bash
cp .env.example .env     # then set JWT_SIGNING_KEY to a long random string
npm ci
npm run db:restore       # or: npm run db:seed
npm run db:hash-passwords
```

`npm run db:hash-passwords` replaces the plain-text passwords with PBKDF2 hashes.
The passwords themselves do not change, so you sign in exactly as before. It is
safe to re-run, and it is needed after either a restore or a seed — both store the
placeholder passwords in clear text, as the backup does.

Then start the two servers in separate terminals:

```bash
npm run start:api
```

```bash
npm start
```

`npm run db:restore` starts the LocalDB instance, restores backup set 7 into the
`SSS` database and prints a row count per table. `npm run db:seed` builds the same
database from `scripts/seed-dev-data.sql` instead. Re-running either replaces the
local database, which is the quickest way to undo test data.

`npm run db:seed` targets LocalDB by default and can point anywhere:

```bash
npm run db:seed -- --server localhost,1434 --user sa   # password from MSSQL_SA_PASSWORD
npm run db:seed -- --help
```

### Option B: Docker

Needs Docker Desktop and Node.js 20+.

```bash
cp .env.example .env     # then set MSSQL_SA_PASSWORD to a strong password
docker compose up -d
npm ci
npm start
```

Compose starts SQL Server 2022, prepares the `SSS` database, verifies the result
and runs the backend on port 5001. Preparing the database means **restoring
`new database/SSS.bak` when that file is there, and seeding the synthetic data when
it is not**, so `docker compose up` works on a machine that has never seen the
backup. [scripts/db-init.sh](scripts/db-init.sh) makes that choice; set
`SSS_DB_INIT` in `.env` to force it:

| `SSS_DB_INIT` | Effect |
| --- | --- |
| `auto` (default) | Restore if `new database/SSS.bak` exists, otherwise seed |
| `restore` | Always restore; fail if the backup is missing |
| `seed` | Always seed, even when the backup is there |

Hashing the placeholder passwords needs nothing extra here: the backend replaces
each one with a PBKDF2 hash the first time that account signs in. To hash all 18
up front, stop the backend container first — `dotnet watch` holds the build output
— and run the migration in a throwaway container:

```bash
docker compose stop backend
docker compose run --rm backend dotnet run -- migrate-passwords
docker compose start backend
```

### Checking it works

- Frontend: <http://localhost:3000>
- API health: <http://localhost:5001/api/health> — reports `status: "ok"` plus row counts
- Swagger: <http://localhost:5001/swagger>

Either path reports 18 users, 6 surveys, 12 news items and 10 courses when it is
healthy.

## Signing in

Passwords are placeholder strings stored in clear text, on both paths.
`npm run db:hash-passwords` hashes them in place without changing what you type, so
the tables below are the logins either way.

**After a restore**, the accounts come from the backup. The login page lists these
three under "Quick role access":

| Role | Email | Password |
| --- | --- | --- |
| Admin | `arman.sargsyan@uni.am` | `hash_admin_1` |
| Lecturer | `gevorg.h@uni.am` | `hash_lect_1` |
| Student | `davit.h@student.uni.am` | `hash_stud_1` |

There are 18 accounts in total, following the same pattern (`hash_admin_2`,
`hash_lect_2`, `hash_stud_3`, and so on).

**After a seed**, the accounts are the invented ones below. There are 18 of them:
2 admins, 4 lecturers and 12 students, all at the reserved `example.edu` domain.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin.one@seed.example.edu` | `hash_admin_1` |
| Admin | `admin.two@seed.example.edu` | `hash_admin_2` |
| Lecturer | `lecturer.one@seed.example.edu` | `hash_lect_1` |
| Lecturer | `lecturer.two@seed.example.edu` … `lecturer.four@…` | `hash_lect_2` … `hash_lect_4` |
| Student | `student.one@student.seed.example.edu` | `hash_stud_1` |
| Student | `student.two@student.seed.example.edu` … `student.twelve@…` | `hash_stud_2` … `hash_stud_12` |

The "Quick role access" buttons on the login page are hardcoded to the three
backup accounts, so on the seeded path they fail with "invalid credentials" — type
a seeded address from the table instead.

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
| `MSSQL_SA_PASSWORD` | Docker, `npm run db:seed` | SA password for the SQL Server container; `db:seed` uses it when `--user` is given without `--password` |
| `SSS_DB_INIT` | Docker only | `auto` (default), `restore` or `seed`; see [Option B](#option-b-docker) |
| `OPENAI_API_KEY` | backend | Enables the AI assistant; without it the Chat page shows a clear "not configured" notice and everything else keeps working |
| `OPENAI_MODEL` | backend | Defaults to `gpt-4o-mini` |

The backend connection string comes from `ConnectionStrings__DefaultConnection`
when set (Docker does this), otherwise from `backend/appsettings.Development.json`,
which points at LocalDB.

## Database schema

The restored database does not match the names the original code used. The current
code follows the database. The "Rows" column gives the restored count first and
the seeded count second where they differ.

| Table | Rows | What it holds |
| --- | --- | --- |
| `UserAccount` | 18 | Accounts; `StudentData` / `LecturerData` extend it |
| `Course`, `StudentCourse` | 10 / 36 | Courses and enrolment |
| `News`, `NewsType`, `NewsTargetRole` | 12 / 5 / 22 | News, categorised and targeted per role |
| `PasswordResetToken` | 0 | Reset tokens, stored hashed. Added by a script, not in the backup |
| `Survey`, `Question` | 6 / 12 (seeded: 6 / 14) | Survey definitions |
| `SurveySession`, `SurveyAnswer` | 16 / 32 (seeded: 18 / 44) | One session per response, one row per answer |
| `Chat`, `ChatMessage` | 12 / 26 | Student/admin support conversations |

[scripts/seed-dev-data.sql](scripts/seed-dev-data.sql) reproduces this schema
exactly — the same columns, types, nullability, identity columns, defaults,
collation and constraint names — so the two paths are interchangeable as far as the
code is concerned.

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
  restore-localdb.ps1     LocalDB restore entry point (npm run db:restore)
  restore-localdb.sql     Restore for LocalDB (Windows paths)
  restore.sql             Restore for Docker (Linux paths)
  restore.sh              Docker restore convenience wrapper
  seed-db.js              Seed entry point (npm run db:seed)
  seed-dev-data.sql       Creates SSS from scratch with synthetic sample data
  db-init.sh              Docker: restore when SSS.bak is there, seed when it is not
  verify.sql              Confirms tables exist and reports row counts
  schema-password-reset-token.sql  Creates the reset token table (used by both paths)
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
