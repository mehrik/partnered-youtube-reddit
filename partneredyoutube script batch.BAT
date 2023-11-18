@echo off
Title Running PartneredYoutube Verification Script v1
cd /d %~dp0
cmd.exe
start npm start
TIMEOUT /T 30
Exit