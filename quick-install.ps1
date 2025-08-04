# Quick one-liner installer for Better Than Spreadsheets GRC
# Run this command in PowerShell as Administrator:
# iwr -useb https://raw.githubusercontent.com/elbrianmcdonald/BetterThanSpreadsheets/main/install-from-git.ps1 | iex

Write-Host "Better Than Spreadsheets GRC - Quick Installer" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will download and run the installer from GitHub." -ForegroundColor Yellow
Write-Host ""
Write-Host "To install, run this command in PowerShell as Administrator:" -ForegroundColor Green
Write-Host ""
Write-Host 'Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/elbrianmcdonald/BetterThanSpreadsheets/main/install-from-git.ps1" | Invoke-Expression' -ForegroundColor White
Write-Host ""
Write-Host "Or the shorter version:" -ForegroundColor Green
Write-Host ""
Write-Host 'iwr -useb https://raw.githubusercontent.com/elbrianmcdonald/BetterThanSpreadsheets/main/install-from-git.ps1 | iex' -ForegroundColor White
Write-Host ""