<#
.SYNOPSIS
    Creates the FleetPMTS database (if missing) and runs schema.sql + seed.sql.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File database/setup.ps1
    powershell -ExecutionPolicy Bypass -File database/setup.ps1 -Database FleetPMTS_Dev -Server "(localdb)\MSSQLLocalDB"

    WARNING: schema.sql drops and recreates every FleetPMTS object, so all data in the
    target database is replaced by the demo seed data.
#>
param(
    [string]$Database = "FleetPMTS_Dev",
    [string]$Server   = "(localdb)\MSSQLLocalDB"
)

$ErrorActionPreference = "Stop"

# Never run against the legacy StarQueen database
if ($Database -ieq "Starqueen_PMTS") {
    throw "Refusing to run against the legacy Starqueen_PMTS database."
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Creating database [$Database] on $Server (if missing)..."
sqlcmd -S $Server -d master -b -Q "IF DB_ID(N'$Database') IS NULL CREATE DATABASE [$Database];"
if ($LASTEXITCODE -ne 0) { throw "Could not create database $Database." }

foreach ($script in @("schema.sql", "seed.sql")) {
    Write-Host "Running $script..."
    sqlcmd -S $Server -d $Database -b -i (Join-Path $here $script)
    if ($LASTEXITCODE -ne 0) { throw "$script failed." }
}

Write-Host "Done. Database [$Database] is ready."
