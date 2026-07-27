@echo off
cd /d %~dp0
echo ============================================
echo  Cycle - local period tracker
echo  Open:  http://localhost:5610
echo.
echo  To open on your phone (same Wi-Fi), use
echo  this PC's LAN IP instead of localhost:
ipconfig | findstr /i "IPv4"
echo  e.g.  http://YOUR-LAN-IP:5610
echo ============================================
python -m http.server 5610
