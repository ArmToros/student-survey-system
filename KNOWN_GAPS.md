# Known gaps

What is unfinished, what is deliberately absent, and what will bite you. Read
this before trusting a screen or filing a bug — several things that look broken
are known and recorded here.

Last reviewed: 2026-10-22.

---

## Not tested

**There are no automated tests.** Not one, frontend or backend. Everything in
this project has been verified by hand against a running instance: calling the
API, reading the database, and looking at the pages in a browser. That is better
than nothing and much worse than a test suite. If you add tests you will be the
first, and the API is the place to start — it holds the rules.

**The Docker path has never been executed.** `docker-compose.yml` and
`scripts/db-init.sh` exist and are kept in step with the PowerShell restore, but
Docker is not installed on the machine this was built on, so that path is
written-but-unproven. Treat the first run as debugging, not deployment.

---

## Deployment

**It runs over plain HTTP.** Sign-ins, bearer tokens and password-reset links
all cross the network in the clear. Acceptable for coursework on a throwaway
dataset; not acceptable for real student data. TLS is the single biggest thing
missing before this could be used for real.

**The whole thing depends on one PC.** The public URL is a VPS running nginx
that proxies over Tailscale to a developer machine, which is where both the app
and SQL Server actually run. If that machine sleeps or drops off the tailnet,
the site returns a gateway error. See [PERSONAL_ACCESS.md](PERSONAL_ACCESS.md).

**The sign-in rate limit is in-memory.** Ten attempts a minute per caller, held
in the process, so two instances would each allow ten. A shared store would be
needed before scaling out. Behind a proxy the limit keys on the proxy unless
`TRUSTED_PROXY` names it — that is configured here, but it is easy to forget on
a new deployment, and the symptom is that one person signing in locks everyone
else out with a `429`.

---

## Email

**Reset and broadcast email only reaches real mailboxes.** Sending works and is
proven, but `uni.am` and `student.uni.am` have **no MX record** — they are not
real mail domains. Mail to those addresses is accepted by Gmail and then
bounces, so almost every seeded account can never receive anything. "Forgot
password" on such an address shows the usual reassuring message and nothing
arrives. Only the `gmail.com` accounts can actually be tested.

**It sends as one Gmail account**, authenticated with an App Password. Gmail's
daily send limits apply, and a broadcast sends one message per recipient, so a
large audience is a lot of messages.

**Attachments are capped at 5 MB** for that reason: the same file is sent once
per recipient, so 10 MB to 300 students is 3 GB on the wire. The right fix for
large files is to upload once and email a link, which is not built.

---

## Data the backup never had

The database comes from a backup, and a few columns were added afterwards. They
are correct for anything created since and empty for anything older:

- **`Survey.CreatedAt` is null for the 12 surveys from the backup**, so the
  "Created" figure on their results page shows a dash. The real dates are not
  recoverable.
- **`UserAccount.JoinDate` is null for admins and lecturers from the backup.**
  It was backfilled from `StartYear`, which only students have. An admin can now
  set it per account; nothing invents one, because a made-up join date is worse
  than a blank. "Days active" is derived from it and is blank for the same
  accounts.
- **`sysdiagrams` is not created** by the seed path. The backup carries that
  SSMS table; nothing in the app uses it.

---

## Behaviour that is deliberate but surprising

**Academic year is not capped.** It is computed from `StartYear` as
`current intake − start year + 1`, floored at 1 but with no upper bound, so a
student who started in 2021 reads **Year 6** in 2026. Whether that should cap at
4, or show "Graduated", is an open question — it has not been decided, so it
counts honestly instead of guessing.

**Surveys close on read, not on a schedule.** A survey past its `Deadline` is
closed the next time anyone fetches it, and on submit. There is no background
job. This is sound because a survey is only reachable through those endpoints,
but it does mean the database can briefly hold an open survey whose deadline has
passed, and a report run straight against SQL would see it that way.

**The support bot's conversation is not stored.** The preset questions and their
answers are, but the thread you see is built in the browser and gone on reload.
It answers from a fixed list; it is not a conversation with anything.

**The AI assistant needs an API key** and returns `503` with a clear message
when one is not configured. That is the normal state here.

**Nothing is paginated.** Every list endpoint returns everything — all surveys,
all accounts, all news. Fine at this size (tens of rows), and the first thing to
break at a real intake's scale. The admin account list has search, filter and
sort to compensate, but it is still fetching the lot.

---

## Settings that were removed

Several settings used to exist, stored a value, and changed nothing. They were
removed rather than left looking like working controls. Recorded here so nobody
re-adds them thinking they were lost:

| Setting | Why it went |
| --- | --- |
| Email / push / survey / news / chat notifications | Nothing consulted them before sending anything |
| Show my email address | No endpoint consulted it; the address was returned either way |
| Show my phone number | The same, for the phone number |
| Notify me by SMS | There is no SMS gateway and never was |
| Two-factor authentication | The code was generated in the browser, emailed via a third party, and never verified by anything. Worse than absent, because it implied protection |
| Auto-logout and session timeout | Removed on request. It did work, but only while the Settings page was open |
| Invite Friends | A referral code and QR to join a system with no sign-up |
| Switch account | A link to the login page that did not sign you out |

Saved preferences are cleared of these keys by
`scripts/data-drop-retired-settings.sql`, which runs as part of the restore
chain because the keys are in the backup and would otherwise come back.

What is left in Settings — theme and language — both take effect immediately.

---

## Smaller things

- **The admin console has no audit trail.** Creating, editing and deleting
  accounts, closing surveys and sending broadcasts leave no record of who did
  what. For a system where admins can change anybody's data, that is a real gap.
- **`src/translations.js` has repeated section names.** `news`, for example,
  appears twice per language — once for the page, once for the admin tile. An
  edit by index rather than by context will put the wrong language in the wrong
  place; it has happened.
- **PWA support is registered** (`serviceWorkerRegistration`, `manifest.json`)
  but untested on the current deployment, and service workers need a secure
  context — so over plain HTTP it does nothing.
- **The old PWA and dependency-fix notes** (`PWA_*.md`, `AJV_FIX_SUMMARY.md`,
  `DEPENDENCY_FIX_SUMMARY.md`) describe one-off work and are not maintained.
  Treat them as history, not documentation.
- **`npm run db:restore` discards everything added since the last restore** and
  reverts all passwords to the backup's placeholders. Run
  `npm run db:set-passwords` afterwards, every time, or nobody can sign in.
