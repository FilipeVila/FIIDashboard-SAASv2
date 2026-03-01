"""
Modelos Pydantic para validação estrita do payload da API.

Segurança:
- extra='forbid' rejeita campos desconhecidos
- max_tokens limitado a 4096
- model validado contra whitelist
- messages com tamanho máximo
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

from core.config import get_settings


# ── Modelos de mensagem ──────────────────────────────────────────────────────

class MessageContent(BaseModel):
    """Conteúdo de uma mensagem (string ou lista de blocos)."""
    model_config = ConfigDict(extra="forbid")

    role: str = Field(..., pattern=r"^(user|assistant)$")
    content: Any  # str ou list de blocos — validado abaixo

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: Any) -> Any:
        if isinstance(v, str):
            if len(v) > 20_000:
                raise ValueError("Conteúdo da mensagem excede 20.000 caracteres")
            return v
        if isinstance(v, list):
            if len(v) > 50:
                raise ValueError("Número de blocos excede o limite de 50")
            return v
        raise ValueError("content deve ser string ou lista de blocos")


# ── Tool definition ──────────────────────────────────────────────────────────

class ToolDefinition(BaseModel):
    """Definição de uma tool permitida."""
    model_config = ConfigDict(extra="allow")

    type: str = Field(..., max_length=100)
    name: str = Field(..., max_length=100)


# ── Request principal ────────────────────────────────────────────────────────

# Modelos permitidos — whitelist fixa no servidor
_ALLOWED_MODELS = {
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
}


class AIRequest(BaseModel):
    """
    Payload válido para POST /api/ai/enrich.
    Campos extras são REJEITADOS automaticamente (extra='forbid').
    """
    model_config = ConfigDict(extra="forbid")

    messages: List[MessageContent] = Field(..., min_length=1, max_length=20)
    model: str = Field(default="claude-3-5-sonnet-20241022", max_length=80)
    max_tokens: int = Field(default=1000, ge=1, le=4096)
    tools: Optional[List[ToolDefinition]] = Field(default=None, max_length=5)

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        if v not in _ALLOWED_MODELS:
            raise ValueError(
                f"Model '{v}' não está na whitelist permitida. "
                f"Modelos válidos: {sorted(_ALLOWED_MODELS)}"
            )
        return v

    @model_validator(mode="after")
    def validate_total_size(self) -> "AIRequest":
        """Garante que o payload total não seja absurdamente grande."""
        import json
        total = len(json.dumps(self.model_dump()))
        if total > 100_000:
            raise ValueError("Payload total excede 100 KB")
        return self


# ── Responses ────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Resposta do health check."""
    status: str
    version: str
    environment: str


class ErrorResponse(BaseModel):
    """Resposta de erro padronizada."""
    error: str
    detail: Optional[str] = None
