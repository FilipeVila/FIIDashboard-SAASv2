# FIIDashboard SaaS v2

Dashboard profissional de FIIs com enriquecimento por IA (Claude), motor de rebalanceamento e análise de carteira.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | Python 3.10+ · FastAPI · Uvicorn · httpx |
| **Frontend** | HTML5 · Vanilla JS (ES6 Modules) · Chart.js |
| **IA** | Anthropic Claude (via web_search) |
| **Segurança** | 7 camadas (ver abaixo) |

## Pré-requisitos

- **Python 3.10+** instalado e no PATH
- Chave de API da Anthropic: [console.anthropic.com](https://console.anthropic.com)

## Instalação e Uso

### 1. Configure sua API Key

Edite o arquivo `backend-python/.env`:
```
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_REAL_AQUI
```

### 2. Inicie o servidor

**Windows** (recomendado):
```
Clique duas vezes em start.bat
```

**Ou manualmente**:
```bash
cd backend-python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 3. Acesse o dashboard

Abra no navegador: **http://localhost:3000**

---

## Estrutura do Projeto

```
FIIDashboard SAAS v2/
├── backend-python/            # 🐍 Backend Python/FastAPI
│   ├── main.py                # App principal + configuração de segurança
│   ├── requirements.txt       # Dependências Python
│   ├── .env                   # Variáveis de ambiente (não commitar!)
│   ├── core/
│   │   └── config.py          # Configurações via pydantic-settings
│   ├── middleware/
│   │   └── security.py        # Security headers HTTP (equivalente ao Helmet)
│   ├── models/
│   │   └── schemas.py         # Pydantic models com validação estrita
│   └── routers/
│       ├── ai.py              # POST /api/ai/enrich (proxy Anthropic)
│       └── health.py          # GET /api/health
│
├── frontend/public/           # 🌐 Frontend (HTML + JS Modules + CSS)
│   ├── index.html             # Página principal (SPA)
│   ├── css/style.css          # Estilos (dark/light theme)
│   └── js/
│       ├── main.js            # Orquestrador (importa os módulos)
│       ├── security.js        # Camada de segurança do frontend
│       ├── parser.js          # Leitura e parse de planilha Excel
│       ├── api.js             # Comunicação com o backend (AI enrich)
│       ├── filters.js         # Filtros de segmento / categoria / fundo
│       ├── charts.js          # Gráficos Chart.js
│       ├── render.js          # KPIs, tabela, chips de IA
│       ├── rebalance.js       # Motor de rebalanceamento v2.1
│       └── ui.js              # Tema, abas, loader
│
└── start.bat                  # Script de inicialização Windows
```

---

## 7 Camadas de Segurança

| # | Camada | Onde | Detalhe |
|---|--------|------|---------|
| 1 | **Validação de Input** | Backend + Frontend | Pydantic `extra='forbid'`, whitelist de modelos, `validateFile` |
| 2 | **Sanitização XSS** | Frontend | `esc()` em todo texto inserido no DOM, `sanitizeAIHtml()` |
| 3 | **Rate Limiting** | Backend (por IP) + Frontend | `slowapi` 60 req/min + counter de sessão |
| 4 | **Security Headers** | Backend (middleware) | CSP, HSTS, X-Frame-Options, Permissions-Policy, etc. |
| 5 | **Proteção de Credenciais** | Backend | API key nunca retornada ou logada, lida apenas do `.env` |
| 6 | **Logging Seguro** | Backend | IPs hasheados (SHA-256), sem conteúdo de mensagens nos logs |
| 7 | **CORS Restrito** | Backend | Apenas origins configuradas em `ALLOWED_ORIGINS` no `.env` |

---

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Health check — retorna status e versão |
| `POST` | `/api/ai/enrich` | Proxy seguro para Anthropic Claude |
| `GET` | `/*` | Serve o frontend (SPA) |

### Documentação interativa (apenas desenvolvimento)

Acesse `http://localhost:3000/docs` para a UI do Swagger.

---

## Segurança — O que NUNCA fazer

- ❌ Commitar o arquivo `.env` com a API key real
- ❌ Usar `ENVIRONMENT=production` sem HTTPS configurado
- ❌ Remover o `SecurityHeadersMiddleware` do `main.py`
- ❌ Adicionar `allow_origins=["*"]` no CORS

---

## Licença

© 2026 @Filipevilanova — Todos os direitos reservados.
