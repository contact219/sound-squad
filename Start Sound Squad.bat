@echo off
rem Double-click to open Sound Squad in your web browser.
cd /d "%~dp0"
start "" http://localhost:5180
python -m http.server 5180 --bind 127.0.0.1
