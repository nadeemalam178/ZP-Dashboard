@echo off
echo Starting local web server for ZP Dashboard...
start http://localhost:8000/index.html
python -m http.server 8000
