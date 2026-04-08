@echo off
echo ============================================
echo   Financial Dashboard - Reiniciando...
echo ============================================

:: Matar cualquier proceso en puerto 3001 y 5173
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173 "') do taskkill /F /PID %%a 2>nul

timeout /t 2 /nobreak > nul

echo [1/2] Iniciando Backend (puerto 3001)...
start "Backend - Financial Dashboard" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 4 /nobreak > nul

echo [2/2] Iniciando Frontend (puerto 5173)...
start "Frontend - Financial Dashboard" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 5 /nobreak > nul
echo Abriendo http://localhost:5173 ...
start http://localhost:5173

echo.
echo Dashboard corriendo. Cierra las ventanas "Backend" y "Frontend" para detener.
