# Student Survey and Feedback System

A university survey system: admins write surveys and news, students answer them,
lecturers run extra courses, and everybody can read what the surveys found.

React 18 in `src/`, ASP.NET Core 8 in `backend/`, SQL Server for the data. In
production the backend serves the built frontend, so the whole thing is one
process on one port.

**New here? Read [Getting it running](#getting-it-running), then
[How it fits together](#how-it-fits-together). [KNOWN_GAPS.md](KNOWN_GAPS.md) is
the honest list of what is unfinished — read it before you trust a screen.**

---

## Getting it running

You need **.NET 8 SDK**, **Node 18+**, and **SQL Server** (Express is fine).

### 1. The database

Two ways to get a database called `SSS`, and they are kept strictly separate.

**Path 1 — restore the real backup.** Get `SSS.bak` from the project owner and
put it at `new database/SSS.bak`. It is not in source control.

```bash
npm run db:restore
npm run db:set-passwords     # see "Signing in" below - do not skip this
```

> The backup holds **seven appended backup sets**. Set 7 is the newest and the
> one the code is written against; set 1 is an empty schema. The restore scripts
> pass `WITH FILE = 7` explicitly — remove that and you silently get an empty
> database.

**Path 2 — seed synthetic data.** Needs nothing but this repository, so it works
on a fresh clone or in CI:

```bash
npm run db:seed
```

Both paths end with a database called `SSS`, and either one **replaces** an
existing one.

If your SQL Server instance is not the default, set `SSS_SQL_INSTANCE` before
restoring — for SQL Server Express that is usually:

```bash
setx SSS_SQL_INSTANCE ".\SQLEXPRESS"
```

### 2. Configuration

Copy `.env.example` to `.env` and fill it in. The file is gitignored and holds
real secrets. The comments in `.env.example` explain each setting; the two that
catch people out are `SMTP_PASSWORD` (Gmail needs an **App Password**, not the
account password) and `TRUSTED_PROXY` (needed behind a reverse proxy, or the
sign-in rate limit applies to everyone at once).

### 3. Run it

Two processes while developing, so the frontend hot-reloads:

```bash
npm run start:api     # the API on http://localhost:5001
npm start             # the app on http://localhost:3000
```

They find each other without configuration: `getApiBaseUrl()` in
`src/services/api.js` returns `http://localhost:5001` when the page is on
`localhost`, and **a relative URL everywhere else**. That is why the published
app needs no base URL — it calls the API on its own origin — and why
`CORS_ALLOWED_ORIGINS` only matters for the two-process setup.

Or one process, serving the built frontend the way production does:

```bash
npm run build
npm run start:app     # everything on http://localhost:5001
```

Check it came up: `GET /api/health` returns row counts and will tell you if the
database is unreachable.

---

## Signing in

**There is no sign-up.** The university issues the addresses and an admin
creates every account. A new person gets an account and a password from an
admin, then changes it through "Forgot password".

The backup ships placeholder passwords (`hash_admin_1` and the like) stored in
clear text. **`npm run db:set-passwords` replaces every one with a real,
hashed password** and writes the new ones to `credentials.local.txt` —
gitignored, and the only copy, because only the hashes are kept. Run it after
every restore, and keep that file somewhere safe.

Three roles, and they see genuinely different things:

| Role | Can do |
| --- | --- |
| **Student** | Answer surveys aimed at them, read news and results, join courses, use support |
| **Lecturer** | The above, plus run courses and see who has answered a survey |
| **Admin** | Everything: write surveys and news, broadcast, and manage accounts |

---

## How it fits together

```
src/                     React app
  pages/                 One file per screen; each has a header comment
  components/            Header, PageHero, route guard
  contexts/              Auth, language, theme
  services/api.js        apiFetch - adds the token, ends the session on a 401
  translations.js        All wording, in English, Russian and Armenian

backend/
  Controllers/           The API, one controller per area
  Models/                EF Core entities, scaffolded from the database
  Services/              Passwords, email, the UTC date converter
  Program.cs             Startup: auth, CORS, rate limiting, static files

scripts/                 Database restore, seed, and additive schema scripts
new database/            Where SSS.bak goes (gitignored)
```

### Things that will surprise you

**The database is not migrated — it is patched.** `SSS` comes from a backup
nobody regenerates, so every schema change is an **additive, re-runnable script
in `scripts/`**, applied in order after each restore by
`scripts/restore-localdb.ps1` and `scripts/db-init.sh`. Add a column by writing
another script and adding it to both lists. Never edit the backup.

**Primary keys are allocated in code.** `UserAccount.ID`, `Survey.SurveyID` and
`Question.QuestionID` are not identity columns in the backup, so inserts read
the current maximum and add one. That is why you will see `GetNextIdAsync`.

**Dates are UTC, and the API says so.** The columns are plain `datetime` with no
offset, so `UtcDateTimeConverter` labels every date with a `Z` on the way out.
Without it a browser reads an unmarked timestamp as local time and everything
shows hours out. Write dates with `DateTime.UtcNow`, never `DateTime.Now`.

**Audience lists mean "everyone" when empty.** Surveys and news can be aimed at
roles. **No rows means everybody**, which is how everything restored from the
backup behaves. Filtering the list is never enough on its own — the submit path
checks the audience again, or somebody outside it could answer by URL.

**The role comes from the token, never the request.** Anything that decides what
a caller may see reads the role from their JWT claims.

---

## Authentication

JWT bearer tokens. Sign-in returns `{ token, expiresAt, user }`; the token
carries the user id, role and email, and the frontend keeps it in
`localStorage`. Passwords are PBKDF2 hashes — the hashing lives in
`PasswordSecurity`, and nothing else should touch a password.

Two policies guard the endpoints: **`Staff`** is admin or lecturer,
**`AdminOnly`** is admin.

Sign-in and password reset are rate limited to **10 attempts a minute** per
caller. Behind a proxy that limit applies to the proxy unless `TRUSTED_PROXY`
names it, in which case the real client address is used instead.

Password reset issues a single-use token that expires, emails a link built from
`APP_BASE_URL`, and answers identically whether or not the address exists — so
it cannot be used to discover accounts.

---

## API

Every route is under `/api`. `signed in` means any authenticated caller.

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/health` | anonymous |
| `POST` | `/auth/login` | anonymous |
| `POST` | `/auth/password-reset/request` | anonymous |
| `POST` | `/auth/password-reset/confirm` | anonymous |
| `GET` | `/dashboard` | signed in |
| `GET` | `/surveys` | signed in |
| `GET` | `/surveys/{id}` | signed in |
| `GET` | `/surveys/{id}/results` | signed in |
| `POST` | `/surveys/{id}/responses` | signed in |
| `GET` | `/surveys/{id}/participation` | Staff |
| `POST` | `/surveys` | AdminOnly |
| `PUT` | `/surveys/{id}/status` | AdminOnly |
| `DELETE` | `/surveys/{id}` | AdminOnly |
| `GET` | `/news`, `/news/types` | signed in |
| `POST`, `PUT`, `DELETE` | `/news`, `/news/{id}` | AdminOnly |
| `POST` | `/broadcast` | AdminOnly |
| `GET` | `/courses` | signed in |
| `POST`, `DELETE` | `/courses/{id}/enrollment` | signed in |
| `GET` | `/courses/statistics` | Staff |
| `POST`, `PUT`, `DELETE` | `/courses`, `/courses/{id}` | Staff |
| `GET` | `/users/{id}`, `/users/{id}/statistics` | self or admin |
| `PUT` | `/users/{id}` | signed in (see below) |
| `POST`, `DELETE` | `/users/{id}/photo` | self or admin |
| `GET`, `POST`, `DELETE` | `/users`, `/users/{id}` | AdminOnly |
| `PUT` | `/users/{id}/password` | AdminOnly |
| `GET`, `POST` | `/support/chats`, `/support/questions` | signed in |
| `PUT`, `DELETE` | `/support/questions/{id}`, `/support/bot` | AdminOnly |
| `POST` | `/ai-assistant/chat` | signed in |

`PUT /users/{id}` is open to any signed-in caller but **restricts what they may
change**: a person may set only their own theme, language and preferences, while
an admin may change anything. The check is inside the method, not on the route.

Three behaviours worth knowing before you call these:

- **Answering a survey twice** returns `409`. The list and the single-survey
  endpoints report `alreadyAnswered` for the caller, so the UI can say so first.
- **A closed survey** returns `409` on submit. A survey past its `Deadline`
  closes itself on the next read.
- **A broadcast** is `multipart/form-data`, not JSON, because it can carry a
  file. Each recipient gets their own message — never one addressed to all.

---

## Deploying

`npm run build` then `npm run start:app` serves everything on one port, so the
frontend calls the API on its own origin and no CORS or base URL is involved.

`index.html` is served `no-store` and everything under `/static` is cached for a
year — those filenames carry a content hash, so a new build is a new URL. Get
this wrong and people keep seeing the previous build after a deploy.

The current deployment is documented in
[PERSONAL_ACCESS.md](PERSONAL_ACCESS.md), including the reverse proxy and its
limitations. **It runs over plain HTTP**, so sign-ins and tokens cross the
network in the clear — fine for coursework, not for real student data.

---

## Working on it

- **Wording goes in `src/translations.js`**, in all three languages. A missing
  key renders as the key itself, so it is obvious when one is forgotten. Note
  that several sections appear more than once per language — `news`, for
  instance, has both a page block and an admin block.
- **Schema changes are scripts**, never edits to the backup. See above.
- **There are no tests.** Everything here has been checked by hand against a
  running instance. If you add tests, you will be the first.
- `npm run build` skips linting for speed; `npm run build:strict` does not.
