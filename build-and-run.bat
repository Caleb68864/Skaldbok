@echo off
echo === Skaldbok Build and Launch ===
echo.

echo [1/3] Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo [2/3] Building project...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Launching preview server...
echo The app will open at http://localhost:4173
echo Press Ctrl+C to stop.
echo.
call npm run preview
pause
