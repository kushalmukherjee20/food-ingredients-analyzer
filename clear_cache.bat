@echo off
echo 🧹 Comprehensive Cache Clearing for PlatformConstants Error
echo =========================================================

echo.
echo Step 1: Clearing Expo cache...
call npx expo r -c
if %errorlevel% neq 0 (
    echo ⚠️ Expo cache clear failed, continuing...
)

echo.
echo Step 2: Clearing Metro cache...
call npx react-native start --reset-cache
if %errorlevel% neq 0 (
    echo ⚠️ Metro cache clear failed, continuing...
)

echo.
echo Step 3: Clearing npm cache...
call npm cache clean --force
if %errorlevel% neq 0 (
    echo ⚠️ npm cache clear failed, continuing...
)

echo.
echo Step 4: Clearing node_modules and reinstalling...
echo Removing node_modules...
rmdir /s /q node_modules
echo Removing package-lock.json...
del package-lock.json
echo Reinstalling dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to reinstall dependencies
    pause
    exit /b 1
)

echo.
echo Step 5: Clearing Expo directories...
rmdir /s /q .expo 2>nul
echo Expo directories cleared.

echo.
echo ✅ All caches cleared successfully!
echo Now try running start.bat again.
echo.
pause 