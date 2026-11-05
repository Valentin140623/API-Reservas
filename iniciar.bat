@echo off
REM Arranca la app completa en Windows: doble clic en este fichero.
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"
if not exist node_modules (
  echo Instalando la web, la primera vez tarda un poco...
  call npm install
)
if not exist backend\.venv (
  echo Instalando el servidor de datos, la primera vez tarda un poco...
  py -3.13 -m venv backend\.venv || py -m venv backend\.venv || python -m venv backend\.venv
  backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
)
start "Servidor de datos" cmd /k "cd backend && .venv\Scripts\uvicorn app.main:app --reload"
start "Web" cmd /k "npm run dev"
timeout /t 5 >nul
start http://localhost:5173
