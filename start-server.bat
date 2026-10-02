@echo off
cd /d "%~dp0"
echo Starting EV Monitor JB dashboard...
echo (Locate Me works best via this local server)
echo.
where python >nul 2>nul && (start "" http://localhost:8000 & python -m http.server 8000 & goto :eof)
where py >nul 2>nul && (start "" http://localhost:8000 & py -m http.server 8000 & goto :eof)
where node >nul 2>nul && (start "" http://localhost:8000 & npx --yes http-server -p 8000 & goto :eof)
echo No Python or Node found. Just double-click index.html instead.
pause
