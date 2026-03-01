@echo off
chcp 65001 > nul
title FIIDashboard SaaS v2 — Servidor Python

echo.
echo  ████████ ██ ██████  ██████   █████  ███████ ██   ██
echo  ██       ██ ██   ██ ██   ██ ██   ██ ██      ██   ██
echo  █████    ██ ██████  ██   ██ ███████ ███████ ███████
echo  ██       ██ ██      ██   ██ ██   ██      ██ ██   ██
echo  ██       ██ ██      ██████  ██   ██ ███████ ██   ██
echo.
echo  FIIDashboard SaaS v2 — Backend Python/FastAPI
echo  ═══════════════════════════════════════════════
echo.

:: Vai para a pasta do backend Python
cd /d "%~dp0backend-python"

:: Verifica se Python está instalado
python --version > nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Python nao encontrado. Instale Python 3.10+ em python.org
    pause
    exit /b 1
)

:: Cria venv se nao existir
if not exist ".venv\" (
    echo  [INFO] Criando ambiente virtual Python...
    python -m venv .venv
    echo  [OK]   Ambiente virtual criado.
)

:: Ativa o venv
call .venv\Scripts\activate.bat

:: Instala dependencias se necessario
pip show fastapi > nul 2>&1
if errorlevel 1 (
    echo  [INFO] Instalando dependencias Python...
    pip install -r requirements.txt --quiet
    echo  [OK]   Dependencias instaladas.
)

:: Verifica se .env existe e tem a chave configurada
findstr /C:"sk-ant-SUA_CHAVE_AQUI" .env > nul 2>&1
if not errorlevel 1 (
    echo.
    echo  [AVISO] Voce ainda nao configurou sua ANTHROPIC_API_KEY no .env!
    echo          Abra o arquivo backend-python\.env e substitua:
    echo          ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
    echo          pela sua chave real da Anthropic.
    echo.
    echo  O servidor vai iniciar, mas o enriquecimento por IA nao funcionara.
    echo.
    timeout /t 5
)

echo  [OK]   Iniciando servidor em http://localhost:3000
echo  [INFO] Pressione Ctrl+C para parar.
echo.

:: Inicia o servidor FastAPI
python main.py

pause
