/**
 * ui.js — Interface de Usuário: tema, abas e loader animado
 */

let _DARK = true;
let _CHARTS_REF = null; // referência ao objeto CHARTS para rebuild ao trocar tema

/**
 * Registra a referência ao objeto CHARTS para poder reconstruir ao trocar tema.
 * @param {object} chartsRef - Objeto { r, c, rd, pv } com instâncias Chart.js
 */
export function setChartsRef(chartsRef) {
    _CHARTS_REF = chartsRef;
}

/**
 * Alterna entre tema dark e light.
 * @param {function} rebuildFn - Função que reconstrói os gráficos
 */
export function toggleTheme(rebuildFn) {
    _DARK = !_DARK;
    document.documentElement.setAttribute('data-theme', _DARK ? 'dark' : 'light');
    const btn = document.getElementById('thBtn');
    if (btn) btn.textContent = _DARK ? '🌙' : '☀️';
    rebuildFn?.();
}

export function isDark() { return _DARK; }

// ── Tab System ─────────────────────────────────────────────────────────────
let _currentTab = 'overview';

/** Troca a aba ativa. */
export function switchTab(tab) {
    _currentTab = tab;
    const ov = document.getElementById('tabOverview');
    const rb = document.getElementById('tabRebalance');
    const btnOv = document.getElementById('tab-overview');
    const btnRb = document.getElementById('tab-rebalance');
    if (ov) ov.style.display = tab === 'overview' ? 'block' : 'none';
    if (rb) rb.style.display = tab === 'rebalance' ? 'block' : 'none';
    btnOv?.classList.toggle('active', tab === 'overview');
    btnRb?.classList.toggle('active', tab === 'rebalance');
}

export function currentTab() { return _currentTab; }

// ── Loader ─────────────────────────────────────────────────────────────────

/** Exibe o loader de carregamento. */
export function showL(msg) {
    [0, 1, 2, 3, 4].forEach(i => {
        const el = document.getElementById('ls' + i);
        if (!el) return;
        el.className = 'l-step-item';
        const chk = el.querySelector('.l-step-check');
        if (chk) chk.textContent = '—';
    });
    _setProgress(0);
    const lMsg = document.getElementById('lMsg');
    if (lMsg) lMsg.textContent = msg || 'Iniciando...';
    document.getElementById('loader')?.classList.add('on');
}

/** Avança o loader para o passo `idx` com a mensagem `msg`. */
export function stepL(idx, msg) {
    if (idx > 0) {
        const prev = document.getElementById('ls' + (idx - 1));
        if (prev) {
            prev.className = 'l-step-item done';
            const chk = prev.querySelector('.l-step-check');
            if (chk) chk.textContent = '✓';
        }
    }
    const cur = document.getElementById('ls' + idx);
    if (cur) cur.className = 'l-step-item active';
    const lMsg = document.getElementById('lMsg');
    if (msg && lMsg) lMsg.textContent = msg;
    _setProgress(idx * 20 + 5);
}

/** Esconde o loader após completar todos os passos. */
export function hideL() {
    _setProgress(100);
    [0, 1, 2, 3, 4].forEach(i => {
        const el = document.getElementById('ls' + i);
        if (!el) return;
        el.className = 'l-step-item done';
        const chk = el.querySelector('.l-step-check');
        if (chk) chk.textContent = '✓';
    });
    setTimeout(() => document.getElementById('loader')?.classList.remove('on'), 600);
}

function _setProgress(pct) {
    const b = document.getElementById('lBar');
    if (b) b.style.width = Math.min(pct, 100) + '%';
}
