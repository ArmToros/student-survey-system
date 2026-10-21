<#
    Starts the Student Survey System the way the tailnet and the VPS expect it:
    the backend serving the built React bundle and the API together on port 5001,
    in Production mode.

    Used by the "StudentSurveySystem" scheduled task so the app runs detached
    from any terminal and comes back at logon. Run it by hand the same way:

        powershell -ExecutionPolicy Bypass -File scripts\serve-app.ps1

    SQL Server Express starts with Windows, so nothing needs to start the
    database. See PERSONAL_ACCESS.md.
#>
[CmdletBinding()]
param(
    [int] $Port = 5001
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'build\index.html'))) {
    throw "No frontend build found. Run 'npm run build' first, or the backend will serve the API only."
}

$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:PORT = $Port

# Logs go to a file because nothing is watching a console here. The log is
# git-ignored (*.log) and is where an unhandled exception's detail ends up,
# since Production returns only a plain message to the caller.
$logPath = Join-Path $repoRoot 'serve-app.log'
"=== started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') on port $Port ===" |
    Out-File -FilePath $logPath -Append -Encoding utf8

& dotnet run --project (Join-Path $repoRoot 'backend\backend.csproj') --no-launch-profile *>&1 |
    Tee-Object -FilePath $logPath -Append
