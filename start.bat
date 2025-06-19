@echo off
echo Starting Food Ingredients Analyzer App...

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

:: Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not installed. Please install Node.js first.
    pause
    exit /b 1
)

:: Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Start the Expo app with tunnel
echo Starting Expo app with tunnel...
echo.
echo Please wait while the tunnel is being established...
echo Once the QR code appears, scan it with your Expo Go app.
echo.
call npx expo start --tunnel --clear

pause 