import httpx
import logging
import json
from typing import List, Optional, Dict, Any
from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class AIFallbackService:
    @staticmethod
    async def enrich_fii(payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Tenta processar a requisição usando múltiplos provedores em ordem de fallback:
        1. Anthropic (Claude)
        2. OpenAI (ChatGPT 1)
        3. OpenAI (ChatGPT 2)
        4. Google (Gemini)
        """
        
        # 1. Tentar Anthropic
        if settings.anthropic_api_key and not settings.anthropic_api_key.startswith("sk-ant-SUA"):
            try:
                logger.info("Tentando provedor: Anthropic")
                return await AIFallbackService._call_anthropic(payload)
            except Exception as e:
                logger.warning(f"Falha no Anthropic: {str(e)}. Tentando fallback...")

        # 2. Tentar OpenAI Key 1
        if settings.openai_api_key_1 and not settings.openai_api_key_1.startswith("sk-proj-SUA"):
            try:
                logger.info("Tentando provedor: OpenAI (Key 1)")
                return await AIFallbackService._call_openai(payload, settings.openai_api_key_1)
            except Exception as e:
                logger.warning(f"Falha no OpenAI (Key 1): {str(e)}. Tentando fallback...")

        # 3. Tentar OpenAI Key 2
        if settings.openai_api_key_2 and not settings.openai_api_key_2.startswith("sk-proj-SUA"):
            try:
                logger.info("Tentando provedor: OpenAI (Key 2)")
                return await AIFallbackService._call_openai(payload, settings.openai_api_key_2)
            except Exception as e:
                logger.warning(f"Falha no OpenAI (Key 2): {str(e)}. Tentando fallback...")

        # 4. Tentar Gemini
        if settings.gemini_api_key and not settings.gemini_api_key.startswith("sk-ant-SUA"):
            try:
                logger.info("Tentando provedor: Gemini")
                return await AIFallbackService._call_gemini(payload)
            except Exception as e:
                logger.error(f"Todos os provedores falharam. Erro final Gemini: {str(e)}")
                raise Exception("Todos os provedores de IA falharam ou estão sem créditos.")
        
        raise Exception("Nenhum provedor de IA configurado corretamente no ambiente.")

    @staticmethod
    async def _call_anthropic(payload: Dict[str, Any]) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            # Se o payload contiver tools (web_search), Anthropic suporta nativamente
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def _call_openai(payload: Dict[str, Any], api_key: str) -> Dict[str, Any]:
        # Converte o payload do formato Anthropic para o formato OpenAI
        messages = []
        for msg in payload.get("messages", []):
            messages.append({
                "role": msg.get("role"),
                "content": msg.get("content")
            })

        openai_payload = {
            "model": "gpt-4o",
            "messages": messages,
            "max_tokens": payload.get("max_tokens", 800),
            "temperature": 0.7
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=openai_payload,
            )
            response.raise_for_status()
            data = response.json()
            
            # Normaliza a saída da OpenAI para o formato esperado pelo frontend (estilo Anthropic)
            return {
                "content": [
                    {
                        "type": "text",
                        "text": data["choices"][0]["message"]["content"]
                    }
                ],
                "model": data["model"],
                "role": "assistant"
            }

    @staticmethod
    async def _call_gemini(payload: Dict[str, Any]) -> Dict[str, Any]:
        # Formato Google Gemini 1.5
        messages = []
        for msg in payload.get("messages", []):
            messages.append({
                "role": "user" if msg.get("role") == "user" else "model",
                "parts": [{"text": msg.get("content")}]
            })

        gemini_payload = {
            "contents": messages,
            "generationConfig": {
                "maxOutputTokens": payload.get("max_tokens", 800),
                "temperature": 0.7
            }
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=gemini_payload)
            response.raise_for_status()
            data = response.json()
            
            # Normaliza saída Gemini para o formato esperado
            return {
                "content": [
                    {
                        "type": "text",
                        "text": data["candidates"][0]["content"]["parts"][0]["text"]
                    }
                ],
                "model": "gemini-1.5-flash",
                "role": "assistant"
            }
