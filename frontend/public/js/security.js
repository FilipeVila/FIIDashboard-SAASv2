/**
 * security.js — Camada 1 e 2 de Segurança no Frontend
 *
 * Camada 1: Validação de Input (arquivo, ticker, números)
 * Camada 2: Sanitização XSS (esc, sanitizeAIHtml)
 * Camada 3: Rate Limiter de sessão (evita spam da API)
 */

// ── Camada 2: Sanitizador XSS ─────────────────────────────────────────────
/** Escapa HTML para prevenir XSS ao inserir texto no DOM. */
export const esc = (s) => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/** Remove scripts e event handlers de HTML retornado pela IA. */
export function sanitizeAIHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '');
}

// ── Camada 1: Validação de Arquivo ───────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

/** Valida arquivo antes do upload. Retorna string de erro ou null se OK. */
export function validateFile(file) {
  if (!file) return 'Nenhum arquivo selecionado.';
  if (!ALLOWED_TYPES.includes(file.type) && !/\.(xlsx|xls)$/i.test(file.name)) {
    return 'Tipo de arquivo inválido. Aceito apenas .xlsx ou .xls.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 10 MB.`;
  }
  return null;
}

/** Sanitiza e valida ticker FII — garante formato XXXXNN. */
export const sanitizeTicker = (s) => {
  const t = String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{4}[0-9]{2}$/.test(t) ? t : null;
};

/** Valida e retorna número seguro — rejeita NaN, Infinity e valores absurdos. */
export const safeNum = (v, parseFn) => {
  const n = parseFn(v);
  if (!isFinite(n) || isNaN(n)) return 0;
  if (Math.abs(n) > 1e12) return 0;
  return n;
};

// ── Camada 3: Rate Limiter de Sessão ─────────────────────────────────────
const RATE = { calls: 0, lastReset: Date.now(), limit: 120 };

/**
 * Verifica rate limit de sessão (frontend).
 * O backend tem rate limit por IP como proteção primária.
 * @throws {Error} se o limite de sessão for atingido
 */
export function checkRateLimit() {
  const now = Date.now();
  if (now - RATE.lastReset > 60_000) {
    RATE.calls = 0;
    RATE.lastReset = now;
  }
  if (RATE.calls >= RATE.limit) {
    throw new Error('Limite de requisições da sessão atingido. Aguarde um momento.');
  }
  RATE.calls++;
}

// ── Proteção de Console em Produção ───────────────────────────────────────
if (location.protocol !== 'file:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  // Em produção: silencia logs para não vazar informações
  console.log = () => {};
  console.warn = () => {};
  console.debug = () => {};
}
