# PowerShell script to start development environment
param(
    [switch]$Build = $false,
    [switch]$Fresh = $false,
    [switch]$Logs = $false,
    [switch]$Stop = $false,
    [switch]$Status = $false
)

$ComposeFile = "docker-compose.dev.yml"
$EnvFile = ".env.dev"

Write-Host "🐳 Cyber Risk Platform - Development Environment" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

if ($Stop) {
    Write-Host "🛑 Stopping development containers..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile --env-file $EnvFile down
    exit 0
}

if ($Status) {
    Write-Host "📊 Container Status:" -ForegroundColor Green
    docker-compose -f $ComposeFile ps
    Write-Host "`n📊 Health Status:" -ForegroundColor Green
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "name=cyberrisk"
    exit 0
}

if ($Fresh) {
    Write-Host "🗑️  Removing existing containers and volumes..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile --env-file $EnvFile down -v
    docker system prune -f
}

if ($Build) {
    Write-Host "🔨 Building containers..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile --env-file $EnvFile build --no-cache
}

Write-Host "🚀 Starting development environment..." -ForegroundColor Green
docker-compose -f $ComposeFile --env-file $EnvFile up -d

# Wait for services to be healthy
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check container status
$containers = docker-compose -f $ComposeFile ps --services

foreach ($container in $containers) {
    $status = docker-compose -f $ComposeFile ps $container
    Write-Host "📦 $container`: " -NoNewline -ForegroundColor Blue
    if ($status -match "Up") {
        Write-Host "✅ Running" -ForegroundColor Green
    } else {
        Write-Host "❌ Not Running" -ForegroundColor Red
    }
}

Write-Host "`n🌐 Development URLs:" -ForegroundColor Cyan
Write-Host "  Application: http://localhost:5000" -ForegroundColor White
Write-Host "  Database:    localhost:5433 (User: cyberrisk_user, Password: CyberRisk123!)" -ForegroundColor White
Write-Host "  PgAdmin:     http://localhost:8080 (admin@cyberrisk.local / admin123)" -ForegroundColor White

Write-Host "`n📝 Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:        .\start-dev.ps1 -Logs" -ForegroundColor White
Write-Host "  Stop containers:  .\start-dev.ps1 -Stop" -ForegroundColor White
Write-Host "  Check status:     .\start-dev.ps1 -Status" -ForegroundColor White
Write-Host "  Rebuild:          .\start-dev.ps1 -Build" -ForegroundColor White
Write-Host "  Fresh start:      .\start-dev.ps1 -Fresh -Build" -ForegroundColor White

if ($Logs) {
    Write-Host "`n📋 Following logs... (Ctrl+C to stop)" -ForegroundColor Yellow
    docker-compose -f $ComposeFile --env-file $EnvFile logs -f
}