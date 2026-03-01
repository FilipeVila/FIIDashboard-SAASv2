"""
Configurações centralizadas da aplicação — lidas do .env via pydantic-settings.
NUNCA altere valores críticos aqui — sempre via .env.
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Chave da API Anthropic — obrigatória
    anthropic_api_key: str

    # Servidor
    port: int = 3000
    host: str = "127.0.0.1"
    environment: str = "development"

    # CORS — lista de origens permitidas
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Rate limiting
    rate_limit_per_min: int = 60

    # Tamanho máximo do payload (bytes) — 1 MB
    max_payload_size: int = 1_048_576

    # API Keys
    anthropic_api_key: str = Field(alias="ANTHROPIC_API_KEY", default="")
    openai_api_key_1: str = Field(alias="OPENAI_API_KEY_1", default="")
    openai_api_key_2: str = Field(alias="OPENAI_API_KEY_2", default="")
    gemini_api_key: str = Field(alias="GEMINI_API_KEY", default="")

    # Configurações de API e Segurança
    allowed_models: List[str] = [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "gpt-4o",
        "gpt-4o-mini",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ]

    @property
    def origins_list(self) -> List[str]:
        """Retorna lista de origins CORS parseada."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Singleton de configurações — carregado uma vez."""
    return Settings()
