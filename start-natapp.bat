@echo off
chcp 65001 >nul
:: Quchen Radio natapp 内网穿透启动脚本
:: authtoken: 508a3428ed5b97bf
:: 本地端口: 3000
:: 外网域名: quchen.nat100.top
::
:: 使用方法: 双击此文件 或 在命令行运行
"C:\tools\natapp\natapp.exe" -authtoken=508a3428ed5b97bf
pause
