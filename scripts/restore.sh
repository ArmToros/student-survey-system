#!/usr/bin/env bash
set -euo pipefail

echo "Starting SQL Server and restoring new database/SSS.bak into database SSS..."
docker compose up -d db
docker compose run --rm db-restore
docker compose up -d backend
echo "Done. Backend should be available at http://localhost:5001"
