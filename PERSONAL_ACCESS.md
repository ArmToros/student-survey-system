# Personal access

How to reach the Student Survey System from elsewhere, and how to set the same
thing up again on another PC. There are two ways in, and they share one backend:

| | Address | Who can reach it |
| --- | --- | --- |
| Tailnet | `http://ehub-pc:5001` | Only devices signed into your tailnet |
| Public | `http://188.34.164.205:8080` | Anyone on the internet |

The app itself only ever runs on this PC. See [Public access](#public-access-via-the-vps)
for what the VPS does and what it costs you in exposure.

Tailscale is a private network between your own devices. Nothing is exposed to
the internet, traffic between devices is encrypted, and the app is only reachable
by machines signed into your tailnet. That matters here: the accounts use
placeholder passwords (`hash_admin_1` and friends) and the database holds
realistic student names, emails and phone numbers, so this must not be public.

## How it is wired

The backend serves the built React app **and** the API on one port, 5001.

- `npm run build` writes the frontend bundle to `build/`
- the backend serves it when that folder exists (`FRONTEND_BUILD_PATH` overrides)
- `REACT_APP_API_BASE_URL` is empty in `.env`, so the frontend calls the API with
  relative URLs

One origin means no CORS entry per device and, more importantly, **no hostname is
baked into the build** - the same `build/` works on `localhost`, a LAN address or
a Tailscale name. Moving to another PC needs no rebuild for that reason alone.

`npm start` (the dev server on port 3000) is unaffected and still works for
development: on `localhost` the frontend falls back to `http://localhost:5001`.

## Daily use

On this PC the app already runs on its own - see
[Keeping it up](#keeping-it-up). Start it by hand with:

```bash
npm run start:app
```

Then open `http://<this-machine>:5001` from any device on your tailnet, where
`<this-machine>` is the name shown by `tailscale status` (or its `100.x.y.z`
address). On this PC `http://localhost:5001` works too.

The database must be running, though SQL Server Express starts with Windows, so
normally it already is.

`npm run start:app` serves in **Production** mode: no Swagger, and unhandled
errors return a plain message instead of a stack trace. For development use
`npm run start:api` with `npm start`, which keeps both and binds to localhost.

Rebuild the frontend after changing anything in `src/`:

```bash
npm run build
```

## Keeping it up

This PC is the host, so the public URL is only alive while it is awake and the
app is running. Three things arrange that, none of which needed administrator
rights:

- **Sleep is disabled on mains power.** `powercfg /change standby-timeout-ac 0`
  and the same for `hibernate-timeout-ac`; it used to sleep after 30 minutes,
  which took the site down with it. The monitor still blanks, which is harmless.
- **The app runs detached.** [scripts/serve-app.ps1](scripts/serve-app.ps1)
  starts it, and it was launched through `Win32_Process.Create` so its process
  tree roots at `services.exe` rather than at whatever terminal started it.
  Closing the terminal, or Claude, does not stop it.
- **It restarts at logon.** `StudentSurveySystem.cmd` in the Startup folder
  (`shell:startup`) runs that script. SQL Server Express starts with Windows by
  itself, so logging in is enough to bring everything back.

Output goes to `serve-app.log` at the repository root, which is git-ignored by
the `*.log` rule. That file is where an unhandled exception's detail ends up,
since Production returns only a plain message to the caller.

### What this still does not survive

**Logging off, or a reboot that nobody logs back in to.** The Startup folder
runs at logon, so the app waits for one. Surviving that needs the app installed
as a Windows service, which does need an administrator shell - `sc.exe create`,
or a wrapper like NSSM. Worth doing if the machine is ever left headless.

Manually sleeping the machine, or closing a laptop lid, still sleeps it.

### Checking and restarting

```powershell
Get-NetTCPConnection -LocalPort 5001 -State Listen
```

To restart it after stopping it, run the Startup entry again:

```powershell
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File D:\Projects\kursayin\scripts\serve-app.ps1
```

## One-time setup on this PC

1. `tailscale up`, then sign in through the link it prints.
2. Allow port 5001 from the tailnet. Run this in an **administrator** PowerShell -
   it is scoped to Tailscale's address range, so it does not open the port to
   your LAN or the internet:

```powershell
New-NetFirewallRule -DisplayName "Student Survey System (Tailscale)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5001 -RemoteAddress 100.64.0.0/10
```

3. Install Tailscale on your phone or laptop and sign in with the same account.

## Public access via the VPS

`188.34.164.205` (Hetzner, Ubuntu 24.04) runs nothing of this app: no SQL Server,
no .NET. It has 1914 MB of RAM, below SQL Server's 2000 MB floor, and port 80
belongs to the `camera-dashboard` service, so the app could not live there even
if you wanted it to.

What it does instead is forward traffic. It joined your tailnet as `sss-proxy`
(`100.110.25.7`) and runs nginx on port 8080, whose only job is
`/etc/nginx/sites-available/student-survey`:

```
proxy_pass http://100.87.45.104:5001;   # ehub-pc over the tailnet
```

So a request to `http://188.34.164.205:8080` goes VPS -> tailnet -> this PC. If
this PC is off, the public URL returns `502 Bad Gateway`.

Three consequences worth remembering:

- **It is plain HTTP on a bare IP.** Logins and the bearer token cross the public
  internet unencrypted. Real HTTPS needs a domain name pointing at that IP; with
  one, Caddy or certbot would issue a certificate automatically.
- **Account passwords must not be the placeholders.** `npm run db:set-passwords`
  replaced all 18 with generated ones, written to `credentials.local.txt`. A
  `npm run db:restore` puts the placeholders back, so re-run it afterwards while
  the public URL is live.
- **The rate limit is now shared.** The backend partitions its 10-requests-per-
  minute limit on `/api/auth/*` by client IP, and every request through the proxy
  arrives from the VPS, so all public users share one bucket.

The login page's "Quick role access" panel is hidden unless the page is opened on
`localhost`, so the public page never lists real account addresses.

### Restarting the proxy

```bash
ssh root@188.34.164.205 "systemctl restart nginx"
```

## Setting it up on a different PC

The app needs Windows with Node 20+, the .NET 8 runtime, and a SQL Server engine.
Use Express, not LocalDB - see [The database engine](#the-database-engine):

```powershell
winget install --id Microsoft.SQLServer.2025.Express --exact --accept-package-agreements --accept-source-agreements
```

That needs an administrator PowerShell. Accept the default instance name
`SQLEXPRESS`; the account you run it as becomes a SQL sysadmin, which is what lets
the backend connect with `Trusted_Connection`.

1. Install the prerequisites, then clone the repository.
2. Copy `new database/SSS.bak` across - it is not in git. Keep it read-only.
3. `cp .env.example .env`, set `JWT_SIGNING_KEY`, leave `REACT_APP_API_BASE_URL`
   empty, and add the `ConnectionStrings__DefaultConnection` line pointing at
   `.\SQLEXPRESS`.
4. Set the restore target so `npm run db:restore` does not default to LocalDB:

```powershell
[Environment]::SetEnvironmentVariable('SSS_SQL_INSTANCE', '.\SQLEXPRESS', 'User')
```

5. `npm ci`
6. `npm run db:restore`
7. `npm run db:set-passwords` - the backup restores the placeholder passwords, so
   this replaces them and writes the new ones to `credentials.local.txt`
8. `npm run build`
9. Install Tailscale, `tailscale up`, add the firewall rule above.
10. `npm run start:app`

The tailnet name changes with the machine, but nothing in the build or the `.env`
refers to it, so there is nothing else to update **on this side**.

11. Point the VPS proxy at the new machine. Its nginx config hardcodes this PC's
    tailnet address, so the public URL keeps reaching the old one until you change
    it. Get the new address from `tailscale ip -4` on the new PC, then:

```bash
ssh root@188.34.164.205 "sed -i 's|proxy_pass http://[0-9.]*:5001;|proxy_pass http://NEW_TAILNET_IP:5001;|' /etc/nginx/sites-available/student-survey && nginx -t && systemctl restart nginx"
```

## The database engine

This machine runs **SQL Server Express 2025** (instance `SQLEXPRESS`, service
`MSSQL$SQLEXPRESS`, start type Automatic), not LocalDB. Two settings point at it:

- `ConnectionStrings__DefaultConnection` in `.env`, which the backend reads and
  which overrides the LocalDB default still sitting in
  `backend/appsettings.Development.json`
- the user environment variable `SSS_SQL_INSTANCE` = `.\SQLEXPRESS`, which
  `scripts/restore-localdb.ps1` reads, so `npm run db:restore` targets Express

Both are overrides rather than edits to the committed defaults, so a fresh clone
elsewhere still works against LocalDB as README.md describes.

The old LocalDB copy of `SSS` is still attached there, along with its files at
`C:\Users\Arman\SSS.mdf` and `SSS_log.ldf`. Nothing uses them any more; they can
be deleted once you are confident the Express setup is behaving.

### Why not LocalDB

LocalDB starts an engine on demand per user and shuts it down when idle. If two
clients ask for `(localdb)\MSSQLLocalDB` while no engine is running - the backend
and a `sqlcmd` window, say - both can start one, and both attach the same
`...\MSSQLLocalDB\master.mdf`. Whichever opened `C:\Users\Arman\SSS.mdf` first
keeps the file; the other sees `SSS` listed in the shared master but cannot open
it. Connections then succeed or fail depending purely on which engine they land
on, which is why `sqlcmd` could read the database while the app could not.

That is what took the app down once. Express avoids it entirely: one service, one
instance, started at boot by Windows rather than on demand by whoever connects
first.

## When everything returns 500 and health says "unavailable"

If this ever comes back, the old cause was **two LocalDB engines running at
once** - which cannot happen on Express. Check `Get-Service MSSQL$SQLEXPRESS`
first; if it is running, the problem is elsewhere.

Work through these in order.

**1. Is the engine running?**

```powershell
Get-Service MSSQL$SQLEXPRESS
```

If it is stopped, `Start-Service MSSQL$SQLEXPRESS` (needs an elevated shell).

**2. Can you reach the database outside the app?**

```powershell
sqlcmd -S ".\SQLEXPRESS" -E -d SSS -Q "SELECT COUNT(*) FROM UserAccount;"
```

18 rows means the database is fine and the problem is in the backend, not SQL.
It is safe to run this while the app is running - that was only a problem on
LocalDB.

**3. Did something point the app back at LocalDB?**

If the backend log says `Cannot open database "SSS" requested by the login` or
mentions `(localdb)`, then `ConnectionStrings__DefaultConnection` is missing from
`.env` and it has fallen back to the LocalDB default in
`backend/appsettings.Development.json`.

Do **not** run `Get-Process sqlservr | Stop-Process -Force`, which was the old
LocalDB remedy - it would now kill the Express service as well.

## Worth knowing

- **The PC has to be on.** This is a tunnel to this machine, not a server, so the
  public URL returns 502 whenever the PC is off or asleep.
- **`npm run start:app` runs the backend in Production mode**, so an unhandled
  error returns `{"message":"Something went wrong. Please try again."}` and the
  stack trace goes only to the backend's own console. Swagger is not served
  either. Both come back under `npm run start:api`, which is Development and
  listens on localhost only.
- **Tailnet traffic is encrypted** by Tailscale, which covers the bearer token.
  Traffic through the VPS is not - see [Public access](#public-access-via-the-vps).
