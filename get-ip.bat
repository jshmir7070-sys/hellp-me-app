@echo off
echo Detecting your PC's IP address...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    set IP=%%a
    set IP=!IP: =!
    echo Found IP: !IP!
    goto :done
)

:done
echo.
echo Your PC IP: %IP%
pause
