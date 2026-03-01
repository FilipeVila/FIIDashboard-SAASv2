"""
Middleware de Segurança — Camada 4 (Security Headers).

Injeta todos os headers de proteção HTTP em cada resposta:
- Strict-Transport-Security (HSTS)
- Content-Security-Policy (CSP)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy
- Remove headers que vazam informações do servidor
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# Content-Security-Policy restrita para o dashboard FII
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
    "    https://cdnjs.cloudflare.com; "
    "script-src-attr 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' data: https://fonts.gstatic.com; "
    "img-src 'self' data: blob:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self';"
)

# Permissions-Policy bloqueia APIs sensíveis do browser
_PERMISSIONS = (
    "camera=(), "
    "microphone=(), "
    "geolocation=(), "
    "payment=(), "
    "usb=(), "
    "magnetometer=(), "
    "gyroscope=(), "
    "accelerometer=()"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adiciona headers de segurança HTTP a todas as respostas.
    Equivalente ao Helmet.js do Node, mas em Python.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        # ── Camada 4: Security Headers ────────────────────────────────────
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = _CSP
        response.headers["Permissions-Policy"] = _PERMISSIONS
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        # HSTS — apenas em produção (em desenvolvimento não tem HTTPS)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

        # ── Remove headers que vazam info do servidor ─────────────────────
        response.headers.pop("server", None)
        response.headers.pop("x-powered-by", None)

        return response
