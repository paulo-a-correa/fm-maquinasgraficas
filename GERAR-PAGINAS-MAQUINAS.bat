@echo off
chcp 65001 >nul
title Felipe Mariano - Gerar paginas das maquinas
echo.
echo ================================================
echo   GERAR PAGINAS HTML DAS MAQUINAS
echo ================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0GERAR-PAGINAS-MAQUINAS.ps1"

echo.
echo Pressione qualquer tecla para fechar.
pause >nul
