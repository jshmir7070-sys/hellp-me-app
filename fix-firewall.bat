@echo off
echo ========================================
echo   Hellp Me - Firewall Configuration
echo ========================================
echo.
echo This will add firewall rules for:
echo   - Backend Server (Port 5000)
echo   - Metro Bundler (Port 8081)
echo.
echo Please run this file as Administrator!
echo.
pause

netsh advfirewall firewall delete rule name="Hellp Me Backend Port 5000" 2>nul
netsh advfirewall firewall delete rule name="Hellp Me Metro Port 8081" 2>nul

netsh advfirewall firewall add rule name="Hellp Me Backend Port 5000" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="Hellp Me Metro Port 8081" dir=in action=allow protocol=TCP localport=8081

echo.
echo ========================================
echo   Firewall rules added successfully!
echo ========================================
echo.
pause
