"""
Router da API de IA — POST /api/ai/enrich.

Segurança implementada:
  Camada 1 — Validação de Input: Pydantic AIRequest (extra='forbid')
  Camada 5 — Proteção de Credenciais: API key lida apenas no servidor, nunca exposta
  Camada 6 — Logging Seguro: sem log de conteúdo de mensagens do usuário
  Camada 3 — Rate Limiting: aplicado via slowapi no app principal
"""
import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
import httpx

from core.config import get_settings, Settings
from models.schemas import AIRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

# URL da Anthropic — nunca exposta ao frontend
_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_ANTHROPIC_VERSION = "2023-06-01"

# Timeout generoso para web_search (pode demorar)
_CLIENT_TIMEOUT = httpx.Timeout(90.0, connect=10.0)


def get_settings_dep() -> Settings:
    return get_settings()


@router.post(
    "/enrich",
    summary="Proxy seguro para Anthropic API",
    description=(
        "Encaminha requisições para a Anthropic Claude API. "
        "A API key nunca é exposta ao cliente. "
        "Payload validado por Pydantic antes do envio."
    ),
)
async def enrich(
    request: Request,
    body: AIRequest,
    settings: Settings = Depends(get_settings_dep),
) -> JSONResponse:
    """
    Proxy seguro para a Anthropic API.

    Fluxo:
    1. Pydantic valida o body (campos extras rejeitados, model na whitelist)
    2. API key lida do ambiente — nunca do cliente
    3. Requisição encaminhada com httpx async
    4. Resposta retornada sem headers internos da Anthropic
    """

    # ── Camada 5: Credenciais — lidas apenas do ambiente ─────────────────
    api_key = settings.anthropic_api_key
    if not api_key or api_key.startswith("sk-ant-SUA_CHAVE"):
        logger.error("ANTHROPIC_API_KEY não configurada ou é o valor template")
        raise HTTPException(
            status_code=500,
            detail="API key não configurada no servidor. Verifique o arquivo .env",
        )

    # ── Monta payload para Anthropic ─────────────────────────────────────
    payload = {
        "model": body.model,
        "max_tokens": body.max_tokens,
        "messages": [m.model_dump() for m in body.messages],
    }
    if body.tools:
        payload["tools"] = [t.model_dump() for t in body.tools]

    # ── Camada 6: Logging Seguro — sem conteúdo de mensagens ─────────────
    client_ip = request.client.host if request.client else "unknown"
    # Hash do IP para anonimização — não logamos o IP real
    import hashlib
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:12]
    logger.info(
        "AI enrich request | ip_hash=%s | model=%s | messages=%d",
        ip_hash,
        body.model,
        len(body.messages),
    )

    # ── Encaminha para Anthropic via httpx async ──────────────────────────
    try:
        async with httpx.AsyncClient(timeout=_CLIENT_TIMEOUT) as client:
            response = await client.post(
                _ANTHROPIC_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": _ANTHROPIC_VERSION,
                },
                json=payload,
            )

        # Propaga erros da Anthropic com contexto útil
        if response.status_code != 200:
            error_body = response.json() if response.content else {"message": "Erro desconhecido"}
            logger.warning(
                "Anthropic retornou %d | ip_hash=%s",
                response.status_code,
                ip_hash,
            )
            raise HTTPException(
                status_code=response.status_code,
                detail=error_body,
            )

        # ── Retorna apenas o corpo da resposta Anthropic ──────────────────
        # NÃO propagamos headers internos da Anthropic (que podem vazar info)
        return JSONResponse(content=response.json())

    except httpx.TimeoutException:
        logger.error("Timeout ao chamar Anthropic | ip_hash=%s", ip_hash)
        raise HTTPException(
            status_code=504,
            detail="Timeout ao comunicar com a API de IA. Tente novamente.",
        )
    except httpx.NetworkError as exc:
        logger.error("Erro de rede Anthropic | ip_hash=%s | %s", ip_hash, type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Erro de rede ao comunicar com a API de IA.",
        )
