"""
Router de health check — GET /api/health.

Retorna apenas informações não-sensíveis sobre o estado do servidor.
Nunca expõe configurações internas, API keys ou dados de usuários.
"""
from fastapi import APIRouter
from models.schemas import HealthResponse
from core.config import get_settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check do servidor",
    description="Verifica se o servidor está operacional. Resposta segura — sem dados sensíveis.",
)
async def health_check() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version="2.0.0",
        environment=settings.environment,
    )
