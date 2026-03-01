/**
 * filters.js — Filtros de Segmento, Categoria e Fundo
 */

/**
 * Popula os selects de filtro com os valores únicos disponíveis em ALL.
 * @param {object[]} ALL - Array completo de FIIs
 */
export function buildFilters(ALL) {
    const segs = [...new Set(ALL.map(d => d.aSeg || d.seg))].sort();
    const cats = [...new Set(ALL.map(d => d.aCat || d.cat))].sort();
    const tks = ALL.map(d => d.tk).sort();
    _pop('fSeg', segs);
    _pop('fCat', cats);
    _pop('fFii', tks);
    document.getElementById('navFilters')?.classList.add('on');
}

function _pop(id, opts) {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">Todos</option>'
        + opts.map(o => `<option value="${o}">${o}</option>`).join('');
    if (opts.includes(cur)) el.value = cur;
}

/**
 * Aplica os filtros selecionados e retorna o subset filtrado.
 * @param {object[]} ALL - Array completo de FIIs
 * @returns {object[]} Subset filtrado
 */
export function applyFilters(ALL) {
    const s = document.getElementById('fSeg')?.value || '';
    const c = document.getElementById('fCat')?.value || '';
    const f = document.getElementById('fFii')?.value || '';
    return ALL.filter(d => {
        const sg = d.aSeg || d.seg;
        const ct = d.aCat || d.cat;
        return (!s || sg === s) && (!c || ct === c) && (!f || d.tk === f);
    });
}
