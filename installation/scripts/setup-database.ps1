# Database Setup Script for CyberRisk App
# This script sets up PostgreSQL and creates the initial database

param(
    [string]$PostgresPassword = "postgres",
    [string]$DatabaseName = "CyberRiskDB",
    [string]$DatabaseUser = "cyberrisk_user",
    [string]$DatabasePassword = "CyberRisk123!",
    [string]$PostgresPath = "C:\Program Files\PostgreSQL\16\bin"
)

Write-Host "CyberRisk Database Setup Script" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

# Check if PostgreSQL is installed
if (-not (Test-Path "$PostgresPath\psql.exe")) {
    Write-Host "PostgreSQL not found at $PostgresPath" -ForegroundColor Red
    Write-Host "Please install PostgreSQL 16 or update the path parameter" -ForegroundColor Yellow
    exit 1
}

# Set environment for PostgreSQL
$env:PGPASSWORD = $PostgresPassword

Write-Host "Creating database and user..." -ForegroundColor Yellow

# Create database setup SQL
$setupSql = @"
-- Check if user exists, create if not
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DatabaseUser') THEN
        CREATE USER $DatabaseUser WITH PASSWORD '$DatabasePassword';
    END IF;
END
`$`$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DatabaseName OWNER $DatabaseUser'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DatabaseName')\gexec

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE $DatabaseName TO $DatabaseUser;

-- Connect to the database and set up extensions
\c $DatabaseName

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO $DatabaseUser;
GRANT CREATE ON SCHEMA public TO $DatabaseUser;
"@

# Save SQL to temporary file
$tempFile = [System.IO.Path]::GetTempFileName()
$setupSql | Out-File -FilePath $tempFile -Encoding UTF8

try {
    # Execute SQL
    & "$PostgresPath\psql.exe" -U postgres -h localhost -f $tempFile
    
    Write-Host "Database setup completed successfully!" -ForegroundColor Green
    
    # Test connection
    Write-Host "`nTesting database connection..." -ForegroundColor Yellow
    $testSql = "SELECT version();"
    $env:PGPASSWORD = $DatabasePassword
    $result = & "$PostgresPath\psql.exe" -U $DatabaseUser -h localhost -d $DatabaseName -c $testSql -t
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database connection successful!" -ForegroundColor Green
        Write-Host "PostgreSQL Version: $result" -ForegroundColor Cyan
    } else {
        Write-Host "Database connection failed!" -ForegroundColor Red
    }
}
catch {
    Write-Host "Error during database setup: $_" -ForegroundColor Red
}
finally {
    # Clean up
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    $env:PGPASSWORD = ""
}

Write-Host "`nDatabase Information:" -ForegroundColor Cyan
Write-Host "Server: localhost" -ForegroundColor White
Write-Host "Database: $DatabaseName" -ForegroundColor White
Write-Host "Username: $DatabaseUser" -ForegroundColor White
Write-Host "Password: $DatabasePassword" -ForegroundColor White
Write-Host "`nConnection String:" -ForegroundColor Cyan
Write-Host "Host=localhost;Database=$DatabaseName;Username=$DatabaseUser;Password=$DatabasePassword" -ForegroundColor White