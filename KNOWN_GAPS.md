# Known gaps

What is wired up, what is not, and what should not ship as it stands. Written
while connecting the React app and the ASP.NET backend to the `SSS` database
restored from `new database/SSS.bak` (backup set 7).

The database schema was deliberately left untouched: no table or column was
altered, added or dropped. The only data change is `UserAccount.PasswordHash`,
which now holds PBKDF2 hashes instead of plain text — the passwords themselves are
unchanged, and `npm run db:restore` reverts even that. Everything else below was
fixed in code, or is listed as outstanding.

## Working end to end

Verified against the restored database, in the browser and over the API.

- Login for all three roles, and rejection of a wrong password
- Dashboard totals and recent surveys (18 users, 6 surveys, 16 responses)
- Survey list, taking a survey, and the results charts
- Submitting a response: writes one `SurveySession` and one `SurveyAnswer` per answer
- University News, filtered by role
- Admin Console (reachable now that roles are normalised)
- Account profile read and update
- AI assistant failing gracefully with a clear notice when no API key is set
- Signing in with hashed passwords, and the full permission matrix: anonymous
  callers blocked, students refused results and survey creation (403), a student
  refused another user's account, a tampered token rejected (401)

## 1. Authentication — now implemented, with caveats

This was the most serious item and has been addressed.

- Passwords are hashed with ASP.NET Core's PBKDF2 hasher. All 18 accounts were
  migrated in place by `npm run db:hash-passwords`, keeping the same passwords, so
  nobody needs new credentials.
- Login issues a signed JWT (12 hour lifetime). The React app sends it as a bearer
  header and signs out when the API rejects it.
- Every endpoint now requires a signed-in caller except health, login, register and
  the password-reset check. Results and survey creation are restricted to admins
  and lecturers; a user account can only be read or changed by its owner or an
  admin.
- Writes take the account id from the token, not the request body. Submitting a
  response with `"userId": 1` from a student's token is recorded against the
  student, not user 1 (verified).
- CORS is limited to `CORS_ALLOWED_ORIGINS` instead of allowing any origin.
- Login answers the same way for an unknown address and a wrong password.
- Sign-in endpoints are rate limited to 10 requests per minute per IP, and an
  address is locked for 15 minutes after 5 failed attempts. Attempts are counted
  against the submitted address whether or not it exists, so the lockout leaks
  nothing either.
- `password-reset-check` no longer reveals whether an address is registered, and
  no longer returns the account holder's name.
- A real password reset exists: a single-use token, stored only as its SHA-256,
  expiring after 30 minutes, emailed as a link and redeemed on a /reset-password
  page. Requesting again supersedes the previous link, and a spent, expired or
  invented token all give the same answer.

What is still open:

- **The token is kept in `localStorage`**, so any XSS on the page can read it. An
  HTTP-only, SameSite cookie plus CSRF protection would be stronger. This was a
  deliberate trade: it keeps the two dev ports simple.
- **No revocation.** A stateless JWT stays valid until it expires, so a
  compromised token cannot be withdrawn and signing out only clears the browser.
  Revocation needs a server-side token store, which means a new table.
- **No refresh tokens**: after 12 hours the user signs in again.
- **Lockout state is in memory.** It resets when the backend restarts, and two
  instances would each keep their own counts. A shared store (Redis, or a table)
  is needed before running more than one instance.
- **Rate limiting partitions on the connection's IP.** Behind a reverse proxy
  that is the proxy, so one shared limit would apply to everyone until forwarded
  headers are configured.
- **No SMTP server is configured here.** With `SMTP_HOST` unset the backend logs
  the reset link instead of sending it, which is deliberate for local work but
  means the mail path itself has not been exercised against a real server. The
  send uses `System.Net.Mail.SmtpClient`; if the provider needs OAuth or modern
  TLS quirks, MailKit would be the usual replacement.
- **Spent tokens are only purged on demand.** `PasswordResetService.PurgeExpiredAsync`
  exists but nothing calls it on a schedule, so the table grows slowly. A nightly
  job or a call on each request would deal with it.
- **Changing a password does not invalidate existing sessions.** JWTs already
  issued keep working until they expire, which matters if the reset was prompted
  by a compromise. Fixing it properly needs the token revocation noted above, or
  a per-user token version claim.
- **Local traffic is plain HTTP.** A bearer token must only travel over HTTPS in
  production.
- **The plain-text fallback is still in `PasswordSecurity.Check`.** It exists so a
  freshly restored database keeps working and upgrades itself at sign-in. Once no
  environment restores an unhashed backup, delete that branch.
- **In Development a missing `JWT_SIGNING_KEY` generates a temporary one** so a
  fresh clone starts; tokens then break on restart. Any other environment refuses
  to start without the key.
- Registration still only creates Students, and there is no admin UI for managing
  roles.

## 2. The Question table has no question text

`dbo.Question` is `(QuestionID, SurveyID, Answear)`. There is no column for the
question text, the question type or the answer options, and the `Answear` values
look like answers rather than questions — `"A"`, `"B"`, and one full sentence.

Current behaviour, since the schema is frozen:

- The question label shown in the UI is the `Answear` value, so questions appear
  as "A" and "B" on the survey form and the results page.
- Answer options are **derived** from the distinct values already recorded in
  `dbo.SurveyAnswer` for that question. This works well for the real data (Likert
  scales such as Strongly Agree / Agree / Neutral / Disagree) but a question with
  no recorded answers falls back to a free-text box.
- Creating a survey stores only the question text, into `Answear`. Type, options,
  required and placeholder are dropped on the way in.

`scripts/migrate-question-text.sql` adds `QuestionText`, `QuestionType` and
`Options` as nullable columns and is **deliberately not applied**. It is additive
and re-runnable, and leaves the misspelled `Answear` column alone.

## 3. The Survey table has no status or dates

`dbo.Survey` is `(SurveyID, CreatedBy, Topic)`. There is no created date, end date
or closed flag, so:

- Every survey reports as `active`; the dashboard always shows 0 completed.
- Created and end dates come back as null (the results page shows a dash).
- A survey cannot be closed or reopened, although the UI implies it can be.

Closing this needs three columns: `CreatedAt`, `ClosedAt`, `IsClosed`.

## 4. Real data with no UI

`Chat` (12 rows) and `ChatMessage` (26 rows) hold genuine student/admin support
conversations — "Grade dispute CS202", "Library card not working" — with replies
and an open/closed flag. Nothing in the app shows them. The Chat page in the UI is
the AI assistant, which is unrelated.

These tables were called `Survey` and `SurveyMessage` in the older backup set,
which is why the original code mapped the survey feature onto them. They would
make a straightforward support-ticket feature: the schema already has the author,
the assigned admin, the thread and the closed state.

`StudentData`, `LecturerData`, `Course` (10) and `StudentCourse` (36) are mapped in
EF but barely surface in the UI either.

## 5. Pages still showing placeholder data

- **Lecturer** (`src/pages/Lecturer.js`) makes no API calls at all; its courses and
  students are hardcoded. The real data for this exists in `Course`,
  `StudentCourse` and `LecturerData`.
- **Settings** (`src/pages/Settings.js`) makes no API calls.
- **Dashboard** falls back to three hardcoded surveys if the API call fails, which
  can look like real data during an outage.
- **News**: `views` and `comments` are always 0 — no such columns exist.
- **Admin Console**: the "Incidents" tile is wired to `totalResponses`, and
  "Pending approvals" is always 0. The quick actions (broadcast, role templates,
  approvals) are not implemented.

## 6. The Timetable feature is gone

The old schema had a `Timetable` table and the scaffolded code had the entity. The
current backup has no such table, so the entity was removed. Worth noting that one
of the support conversations is a student unable to access their timetable, so the
feature was presumably intended.

## 7. Smaller items

- No automated tests of any kind, frontend or backend.
- `GET /api/surveys` and `/api/news` return everything with no pagination.
- Unhandled exceptions return a full stack trace, because the developer exception
  page is on and there is no exception handler for production.
- Registration always creates a Student; there is no way to create or change an
  admin or lecturer through the app.
- The Docker path (`docker compose up -d`) was not run during this work, because
  Docker Desktop is not installed on this machine. Its scripts were updated in the
  same way as the LocalDB ones but are unverified.
- Only backup set 7 is ever restored. Sets 1-6 are older, and set 1 is empty.

## What changed in the code

For context when reviewing the diff. No database changes.

- EF model rebuilt against the real schema: added `Survey`, `Question`,
  `SurveySession`, `SurveyAnswer`; renamed the old `Survey`/`SurveyMessage`
  entities to `Chat`/`ChatMessage`; removed `Timetable`.
- `SurveysController` and `DashboardController` rewritten against the survey
  tables; `AiAssistantController` updated to match.
- `UserPresentation` added: converts the stored `"Admin"` / `"Light"` /
  `"Armenian"` values to the `admin` / `light` / `am` the frontend expects, and
  back again when saving. Without it `ProtectedRoute` locked admins and lecturers
  out of their own pages.
- Both restore scripts now pass `WITH FILE = 7`; without it SQL Server restored
  the oldest, empty backup set.
- The demo seed script was deleted. It targeted the old schema, failed against this
  backup, and the restored database already has real data. `scripts/verify.sql`
  replaces it with a table and row-count check.
- Login's "Quick role access" now lists accounts that actually exist.
- The backend loads `.env` at startup, so `OPENAI_API_KEY` works outside Docker.
- Authentication added: `PasswordSecurity` (PBKDF2 with plain-text upgrade),
  `JwtTokenService`, `PasswordMigration`, JWT bearer validation and the
  `Staff`/`AdminOnly` policies in `Program.cs`, `[Authorize]` across the
  controllers, and a CORS origin list.
- The frontend sends the bearer token on every call, drops a session the API
  rejects, hides "View Results" from students and guards the results and
  create-survey routes.
- The only database change in this work: `UserAccount.PasswordHash` now holds
  hashes instead of plain text. Everything else is exactly as restored.
