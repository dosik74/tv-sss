
@echo off
REM Запускает backend (FastAPI) и frontend (Vite) в отдельных окнах
cd /d %~dp0

REM Порты и адреса
SET "FRONTEND_HOST=localhost"
SET "FRONTEND_PORT=3000"
SET "BACKEND_HOST=localhost"
SET "BACKEND_PORT=8001"

echo Запускаем backend...
start "Backend" cmd /k "cd /d %~dp0 && python -m uvicorn server.app:app --host 0.0.0.0 --port %BACKEND_PORT%"

echo Запускаем frontend...
start "Frontend" cmd /k "cd /d %~dp0 && npm run dev -- --host 0.0.0.0 --port %FRONTEND_PORT%"

echo.
echo Backend: http://%BACKEND_HOST%:%BACKEND_PORT%
echo API docs: http://%BACKEND_HOST%:%BACKEND_PORT%/docs
echo Frontend: http://%FRONTEND_HOST%:%FRONTEND_PORT%
echo.

REM Открыть фронтенд в браузере по умолчанию
start "" "http://%FRONTEND_HOST%:%FRONTEND_PORT%"

echo Все процессы запущены.
pause
