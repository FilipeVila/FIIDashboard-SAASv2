"""
Router da API de IA — POST /api/ai/enrich.
Implementa fallback automático: Anthropic -> OpenAI -> Gemini.
"""
import logging
import hashlib
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse

from core.config import get_settings, Settings
from models.schemas import AIRequest
from services.ai_fallback import AIFallbackService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

def get_settings_dep() -> Settings:
    return get_settings()

@router.post(
    "/enrich",
    summary="Enriquecimento de dados FII com IA (Fallback)",
    description=(
        "Proxy inteligente que alterna entre Claude, ChatGPT e Gemini "
        "caso um provedor esteja fora do ar ou sem créditos."
    ),
)
async def enrich(
    request: Request,
    body: AIRequest,
    settings: Settings = Depends(get_settings_dep),
) -> Dict[str, Any]:
    """
    Endpoint de enriquecimento com redundância automática.
    """
    # ── Camada 6: Logging Seguro ─────────────────────────────────────────
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:12]
    
    logger.info(
        "AI enrich request | ip_hash=%s | model=%s",
        ip_hash,
        body.model,
    )

    try:
        # Chama a orquestração de fallback que decide qual API usar
        result = await AIFallbackService.enrich_fii(body.model_dump())
        return result

    except Exception as e:
        logger.error(f"Erro fatal no serviço de IA: {str(e)} | ip_hash={ip_hash}")
        raise HTTPException(
            status_code=500,
            detail=str(e) if not settings.is_production else "Erro interno no serviço de IA multi-provedor."
        )
