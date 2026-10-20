<#
    Restores "new database\SSS.bak" into SQL Server LocalDB and verifies the result.

    Use this when Docker Desktop is not installed. The Docker equivalent is
    "docker compose up -d", which runs scripts/restore.sql in the db-restore service.

    Usage (from anywhere):
        powershell -ExecutionPolicy Bypass -File scripts\restore-localdb.ps1

    Re-running it replaces the local SSS database.
#>
[CmdletBinding()]
param(
    # Defaults to LocalDB, which is what a fresh clone has. Set SSS_SQL_INSTANCE
    # (for example '.\SQLEXPRESS') to restore somewhere else without passing
    # -Instance every time; an explicit -Instance still wins.
    [string] $Instance   = $(if ($env:SSS_SQL_INSTANCE) { $env:SSS_SQL_INSTANCE } else { '(localdb)\MSSQLLocalDB' }),
    [string] $BackupFile,
    [int]    $BackupSet  = 7,
    [switch] $SkipVerify
)

$ErrorActionPreference = 'Stop'

$repoRoot    = Split-Path -Parent $PSScriptRoot
$scriptsDir  = $PSScriptRoot

if (-not $BackupFile) {
    $BackupFile = Join-Path $repoRoot 'new database\SSS.bak'
}

if (-not (Test-Path -LiteralPath $BackupFile)) {
    throw "Backup not found: $BackupFile`nGet SSS.bak from the project owner and put it in '$repoRoot\new database\'."
}

$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if (-not $sqlcmd) {
    throw 'sqlcmd was not found on PATH. Install the SQL Server command line tools (or SQL Server Express / LocalDB).'
}

# LocalDB instances are stopped when idle; starting an already-running one is a no-op.
$localdb = Get-Command sqllocaldb -ErrorAction SilentlyContinue
if ($localdb -and $Instance.StartsWith('(localdb)')) {
    $instanceName = $Instance.Split([char]92)[-1]
    Write-Host "Starting LocalDB instance $instanceName..."
    & sqllocaldb start $instanceName | Out-Null
}

Write-Host "Restoring backup set $BackupSet of '$BackupFile' into database SSS on $Instance..."
# sqlcmd rejects -v values containing spaces, and the folder is called
# "new database", so the script variables are passed as environment variables
# instead - sqlcmd resolves $(BackupFile) from the environment just the same.
$env:BackupFile = $BackupFile
$env:BackupSet  = $BackupSet
& sqlcmd -S $Instance -b -C -i (Join-Path $scriptsDir 'restore-localdb.sql')
if ($LASTEXITCODE -ne 0) { throw "Restore failed (sqlcmd exit code $LASTEXITCODE)." }

# The backup predates the password reset feature, so its table is created after
# every restore.
Write-Host 'Applying additive schema and data scripts...'
# A restore recreates the database from the backup, which predates all of these,
# so they run every time. Each one is additive and re-runnable.
$followUpScripts = @(
    'schema-password-reset-token.sql',  # the reset token table
    'schema-authoring.sql',             # question type/options, survey category and status
    'data-news-categories.sql'          # the four news categories the UI offers
)

foreach ($followUp in $followUpScripts) {
    & sqlcmd -S $Instance -b -C -i (Join-Path $scriptsDir $followUp)
    if ($LASTEXITCODE -ne 0) { throw "$followUp failed (sqlcmd exit code $LASTEXITCODE)." }
}

if ($SkipVerify) {
    Write-Host 'Skipping verification as requested.'
} else {
    # The restored backup already contains real accounts, surveys and news,
    # so there is nothing to seed - just confirm what landed.
    Write-Host 'Verifying restored tables and row counts...'
    & sqlcmd -S $Instance -b -C -i (Join-Path $scriptsDir 'verify.sql')
    if ($LASTEXITCODE -ne 0) { throw "Verification failed (sqlcmd exit code $LASTEXITCODE)." }
}

Write-Host ''
Write-Host 'Database SSS is ready.' -ForegroundColor Green
Write-Host 'Next: npm run start:api   (backend on http://localhost:5001)'
Write-Host '      npm start           (frontend on http://localhost:3000)'
