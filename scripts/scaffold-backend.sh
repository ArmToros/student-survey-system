#!/bin/bash
# Install EF tool globally in the container
dotnet tool install --global dotnet-ef || true
export PATH="$PATH:/root/.dotnet/tools"

# Scaffold DbContext
: "${MSSQL_SA_PASSWORD:?Set MSSQL_SA_PASSWORD in your shell or local .env file}"

dotnet ef dbcontext scaffold "Server=db;Database=SSS;User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=True" Microsoft.EntityFrameworkCore.SqlServer -o Models --force
