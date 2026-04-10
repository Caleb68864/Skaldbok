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
echo [3/3] Launching HTTPS preview server...
echo.
echo On this PC:     https://localhost:4173
echo On your tablet: https://YOUR_PC_IP:4173
echo.
echo First visit will show a certificate warning - tap Advanced then Proceed.
echo After that you can install the app as a PWA.
echo.
echo Press Ctrl+C to stop.
echo.
call npx vite preview --host --port 4173
pause
