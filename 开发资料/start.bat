@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [启动中] 正在启动 The Lethe Workbench 调试服务...
echo [访问地址] http://127.0.0.1:3081
node src/cli.mjs serve --port=3081
pause
