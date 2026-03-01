"""
FIIDashboard SaaS v2 — Backend Python/FastAPI
=============================================

Arquitetura de segurança em 7 camadas:
  1. Validação de Input   — Pydantic (extra='forbid', whitelist de modelos)
  2. Sanitização XSS      — feita no frontend (js/security.js)
  3. Rate Limiting        — slowapi (por IP, 60 req/min)
  4. Security Headers     — SecurityHeadersMiddleware (CSP, HSTS, etc.)
  5. Proteção Credenciais — API key nunca exposta ao cliente
  6. Logging Seguro       — IPs hasheados, sem dados de usuário nos logs
  7. CORS Restrito        — apenas origens configuradas no .env
"""
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core.config import get_settings
from middleware.security import SecurityHeadersMiddleware
from routers import ai, health

# ── Configuração de Logging (Seguro) ─────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
# Silencia logs verbosos de bibliotecas externas em produção
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# ── Camada 3: Rate Limiter (slowapi) ─────────────────────────────────────────
settings = get_settings()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_per_min}/minute"],
)


# ── Lifecycle ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 FIIDashboard API v2.0 iniciando...")
    logger.info("   Ambiente: %s", settings.environment)
    logger.info("   Rate limit: %d req/min por IP", settings.rate_limit_per_min)
    logger.info("   CORS origins: %s", settings.origins_list)
    # Nunca logamos a API key, nem parte dela
    logger.info("   Anthropic API key: [CONFIGURADA]" if settings.anthropic_api_key and not settings.anthropic_api_key.startswith("sk-ant-SUA") else "   ⚠️  Anthropic API key: [NÃO CONFIGURADA]")
    yield
    logger.info("🛑 FIIDashboard API v2.0 encerrando...")


# ── Aplicação FastAPI ────────────────────────────────────────────────────────
app = FastAPI(
    title="FIIDashboard SaaS API",
    version="2.0.0",
    description="Backend seguro para o FIIDashboard — Python/FastAPI",
    # Desabilita docs em produção para não expor schema interno
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

# ── Camada 3: Rate Limiting ───────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Camada 4: Security Headers ───────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ── Camada 7: CORS Restrito ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=False,          # sem cookies de credenciais cross-origin
    allow_methods=["GET", "POST"],    # apenas métodos necessários
    allow_headers=["Content-Type"],   # apenas headers necessários
    max_age=600,                      # cache de preflight de 10 min
)

# ── Routers da API ───────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(ai.router)

# ── Frontend Estático ────────────────────────────────────────────────────────
_FRONTEND = Path(__file__).parent.parent / "frontend" / "public"
# No Vercel, o caminho pode ser diferente dependendo de como as pastas são montadas
if not _FRONTEND.exists():
    _FRONTEND = Path(__file__).parent / "frontend" / "public"

if _FRONTEND.exists():
    # Monta arquivos estáticos (CSS, JS, etc.) — mas NÃO sobrescreve rotas da API
    app.mount("/css", StaticFiles(directory=str(_FRONTEND / "css")), name="css")
    app.mount("/js", StaticFiles(directory=str(_FRONTEND / "js")), name="js")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(request: Request, full_path: str):
        """Serve o index.html para qualquer rota não mapeada pela API (SPA)."""
        # Nunca serve arquivos fora de _FRONTEND (path traversal protection)
        index = _FRONTEND / "index.html"
        if not index.exists():
            return JSONResponse({"error": "Frontend não encontrado"}, status_code=404)
        return FileResponse(str(index))
else:
    logger.warning("⚠️  Pasta frontend não encontrada em: %s", _FRONTEND)


# ── Handler global de erros ───────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Handler genérico — nunca expõe stack trace ou detalhes internos em produção.
    """
    if settings.is_production:
        logger.error("Erro não tratado: %s", type(exc).__name__)
        return JSONResponse(
            {"error": "Erro interno do servidor"},
            status_code=500,
        )
    # Em desenvolvimento, mostra detalhes
    logger.exception("Erro não tratado")
    return JSONResponse(
        {"error": str(exc), "type": type(exc).__name__},
        status_code=500,
    )


# ── Entry point para execução direta ─────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=not settings.is_production,
        log_level="info",
        # Headers adicionais de segurança do servidor
        server_header=False,   # remove "Server: uvicorn"
        date_header=False,     # remove "Date" header
    )
