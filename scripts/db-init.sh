#!/usr/bin/env bash
# Prepares the SSS database inside Docker, by one of two paths:
#
#   restore - restore "new database/SSS.bak" (backup set 7), the real data.
#   seed    - create the database from scratch with the synthetic sample data in
#             scripts/seed-dev-data.sql, for machines that do not have the backup.
#
# Which one runs is decided by SSS_DB_INIT:
#   auto (default) - restore when the backup file is there, seed when it is not
#   restore        - restore, and fail if the backup is missing
#   seed           - seed, even if the backup is there
#
# This runs as the db-init step of docker-compose.yml. The equivalents outside
# Docker are "npm run db:restore" and "npm run db:seed".
#
# Expects the SQL Server tools of the mssql image, the scripts folder mounted at
# /app/scripts, and these variables:
#   SA_PASSWORD   password for the sa login
#   SQL_HOST      server to connect to (default: db)
#   BACKUP_FILE   where the backup is mounted (default: /var/opt/mssql/backup/SSS.bak)
set -euo pipefail

SQLCMD="${SQLCMD:-/opt/mssql-tools18/bin/sqlcmd}"
SQL_HOST="${SQL_HOST:-db}"
BACKUP_FILE="${BACKUP_FILE:-/var/opt/mssql/backup/SSS.bak}"
SSS_DB_INIT="${SSS_DB_INIT:-auto}"
SCRIPTS_DIR="${SCRIPTS_DIR:-/app/scripts}"

if [ -z "${SA_PASSWORD:-}" ]; then
    echo "SA_PASSWORD is not set. Set MSSQL_SA_PASSWORD in your .env file." >&2
    exit 1
fi

# -C trusts the container's self-signed certificate; -b exits non-zero on a SQL error.
run_sql() {
    "$SQLCMD" -S "$SQL_HOST" -U sa -P "$SA_PASSWORD" -C -b -i "$1"
}

# Work out which path to take before waiting for the server, so a missing backup
# or a typo in SSS_DB_INIT fails straight away.
case "$SSS_DB_INIT" in
    auto)
        if [ -f "$BACKUP_FILE" ]; then
            mode=restore
        else
            mode=seed
            echo "No backup at $BACKUP_FILE, so the database will be seeded with synthetic data."
            echo "Put SSS.bak in 'new database/' to restore the real data instead."
        fi
        ;;
    restore|seed)
        mode="$SSS_DB_INIT"
        ;;
    *)
        echo "SSS_DB_INIT must be auto, restore or seed (got '$SSS_DB_INIT')." >&2
        exit 1
        ;;
esac

if [ "$mode" = restore ] && [ ! -f "$BACKUP_FILE" ]; then
    echo "SSS_DB_INIT=restore but there is no backup at $BACKUP_FILE." >&2
    echo "Get SSS.bak from the project owner and put it in 'new database/', or use SSS_DB_INIT=seed." >&2
    exit 1
fi

echo "Waiting for SQL Server on $SQL_HOST..."
until "$SQLCMD" -S "$SQL_HOST" -U sa -P "$SA_PASSWORD" -C -Q "SELECT 1" > /dev/null 2>&1; do
    sleep 2
done

if [ "$mode" = restore ]; then
    echo "Restoring $BACKUP_FILE into database SSS..."
    run_sql "$SCRIPTS_DIR/restore.sql"

    # The backup predates both the password reset feature and the survey authoring
    # columns, so they are added after every restore. The seed path creates them
    # itself, by including the same two scripts.
    echo "Applying additive schema scripts..."
    run_sql "$SCRIPTS_DIR/schema-password-reset-token.sql"
    run_sql "$SCRIPTS_DIR/schema-authoring.sql"
    run_sql "$SCRIPTS_DIR/schema-support-chat.sql"
    run_sql "$SCRIPTS_DIR/data-news-categories.sql"
else
    echo "Seeding database SSS with the synthetic sample data..."
    # seed-dev-data.sql includes schema-password-reset-token.sql through sqlcmd's
    # :r directive, which resolves its path from this variable.
    export SssScriptsDir="$SCRIPTS_DIR"
    run_sql "$SCRIPTS_DIR/seed-dev-data.sql"
fi

echo "Verifying tables and row counts..."
run_sql "$SCRIPTS_DIR/verify.sql"

if [ "$mode" = seed ]; then
    echo ""
    echo "Database SSS is seeded with synthetic data. The logins are in README.md."
fi

echo "Database $mode finished."
