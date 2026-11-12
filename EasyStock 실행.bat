@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "APP=%ROOT%portfolio-app"

if not exist "%APP%\portfolio-backend\.venv\Scripts\python.exe" (
    echo Backend Python environment was not found.
    echo Please check that portfolio-app\portfolio-backend\.venv exists.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo Node.js and npm are required. Install Node.js, then run this file again.
    pause
    exit /b 1
)

if not exist "%APP%\portfolio-frontend\node_modules" (
    echo Installing frontend packages for the first run...
    pushd "%APP%\portfolio-frontend"
    call npm install
    if errorlevel 1 (
        popd
        echo Frontend package installation failed.
        pause
        exit /b 1
    )
    popd
)

start "EasyStock Backend" /D "%APP%\portfolio-backend" "%APP%\portfolio-backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
start "EasyStock Frontend" /D "%APP%\portfolio-frontend" cmd /k "npm run dev -- --host 127.0.0.1"

timeout /t 3 /nobreak >nul
start "" http://localhost:5173
endlocal
