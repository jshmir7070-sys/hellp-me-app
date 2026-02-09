Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Hellp Me - Metro Bundler Starter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Killing existing Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "[2/5] Cleaning cache directories..." -ForegroundColor Yellow
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:TEMP\metro-*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:TEMP\react-native-*" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Cache cleaned!" -ForegroundColor Green

Write-Host "[3/5] Checking if port 8081 is free..." -ForegroundColor Yellow
$port8081 = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($port8081) {
    Write-Host "Port 8081 is in use. Attempting to free it..." -ForegroundColor Red
    $processId = $port8081[0].OwningProcess
    Stop-Process -Id $processId -Force
    Start-Sleep -Seconds 2
}
Write-Host "Port 8081 is free!" -ForegroundColor Green

Write-Host "[4/5] Setting environment variables..." -ForegroundColor Yellow
$env:EXPO_NO_GIT_STATUS = "1"
$env:NODE_OPTIONS = "--max-old-space-size=4096"

Write-Host "[5/5] Starting Metro Bundler..." -ForegroundColor Yellow
Write-Host "This may take 1-3 minutes on first run..." -ForegroundColor Cyan
Write-Host ""

npx expo start --clear --port 8081

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
