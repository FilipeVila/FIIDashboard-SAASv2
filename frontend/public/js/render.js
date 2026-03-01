/**
 * render.js — Renderização de KPIs, Tabela e AI Chips
 */
import { esc } from './security.js';

// ── Utilitários de Formatação ───────────────────────────────────────────────
export const sm = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);

export const fmt = (v) => {
    if (v == null) return '—';
    return 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtBig = (v) => {
    const x = Math.abs(parseFloat(v) || 0);
    const s = parseFloat(v) < 0 ? '-' : '';
    if (x >= 1e6) return s + 'R$ ' + (x / 1e6).toFixed(2) + 'M';
    if (x >= 1e3) return s + 'R$ ' + (x / 1e3).toFixed(1) + 'k';
    return s + fmt(v);
};

// ── Render Principal ───────────────────────────────────────────────────────
/**
 * Reseta e reconstrói o dashboard com os dados filtrados.
 * @param {object[]} FIL - FIIs filtrados
 * @param {object} CHARTS - Objeto de referências dos charts (será limpo)
 * @param {function} rebuildChartsFn - Função do módulo charts.js
 */
export function render(FIL, CHARTS, rebuildChartsFn) {
    Object.values(CHARTS).forEach(c => { try { c.destroy(); } catch { } });
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('dash').style.display = 'block';
    const aiCnt = document.getElementById('aiCnt');
    if (aiCnt) aiCnt.textContent = '0/0';
    const sNum = document.getElementById('sNum');
    if (sNum) sNum.textContent = `${FIL.length} fundo${FIL.length !== 1 ? 's' : ''}`;
    document.getElementById('rbDiag').style.display = 'none';
    document.getElementById('rbPlaceholder').style.display = 'block';
    renderKPIs(FIL);
    renderAIChips(FIL);
    renderTable(FIL);
    rebuildChartsFn();
}

// ── KPI Cards ──────────────────────────────────────────────────────────────
export function renderKPIs(FIL) {
    const D = FIL;
    const tp = sm(D, 'tp'), ta = sm(D, 'ta');
    const dc = ta - tp, dcP = tp > 0 ? dc / tp * 100 : 0;
    const pv = sm(D, 'pr');
    const rl = dc + pv, rlP = tp > 0 ? rl / tp * 100 : 0;
    const rd = sm(D, 'ga');
    const dyM = D.length ? D.reduce((s, x) => s + (x.aDy || x.dy), 0) / D.length : 0;
    const pvArr = D.map(x => x.aPv || x.pv).filter(v => v > 0);
    const pvM = pvArr.length ? pvArr.reduce((a, b) => a + b, 0) / pvArr.length : 0;
    const nDisc = D.filter(x => (x.aPv || x.pv) < 1).length;

    const cards = [
        {
            lbl: 'PATRIMÔNIO TOTAL', tag: 'PREÇO ATUAL',
            accent: 'linear-gradient(90deg,#4da6ff,#2dd4bf)',
            glow: 'rgba(77,166,255,.08)', ibg: 'rgba(77,166,255,.12)',
            tbg: 'rgba(77,166,255,.1)', tc: 'var(--blue)',
            ico: '💼', num: fmtBig(ta), numCls: 'kpi-num-md',
            foot: `<span class="muted">Investido: </span><strong>${fmt(tp)}</strong>`,
            delta: { v: dcP, cls: dcP >= 0 ? 'd-up' : 'd-dn', txt: (dcP >= 0 ? '+' : '') + dcP.toFixed(2) + '% cap' },
            delay: 0,
        },
        {
            lbl: 'RESULTADO REAL', tag: 'CAP. + PROVENTOS',
            accent: rl >= 0 ? 'linear-gradient(90deg,#22d47e,#2dd4bf)' : 'linear-gradient(90deg,#f05454,#ff8c42)',
            glow: rl >= 0 ? 'rgba(34,212,126,.08)' : 'rgba(240,84,84,.08)',
            ibg: rl >= 0 ? 'rgba(34,212,126,.12)' : 'rgba(240,84,84,.12)',
            tbg: rl >= 0 ? 'var(--gbg)' : 'var(--rbg)', tc: rl >= 0 ? 'var(--green)' : 'var(--red)',
            ico: '📈', num: (rl >= 0 ? '+' : '') + fmtBig(rl), numCls: 'kpi-num-md',
            foot: `<span class="muted">Proventos acum.: </span><strong class="pos">${fmt(pv)}</strong>`,
            delta: { v: rlP, cls: rlP >= 0 ? 'd-up' : 'd-dn', txt: (rlP >= 0 ? '+' : '') + rlP.toFixed(2) + '% retorno' },
            delay: .07,
        },
        {
            lbl: 'RENDA MENSAL EST.', tag: 'MÊS ATUAL',
            accent: 'linear-gradient(90deg,#f5c542,#ff8c42)',
            glow: 'rgba(245,197,66,.08)', ibg: 'rgba(245,197,66,.12)',
            tbg: 'rgba(245,197,66,.1)', tc: 'var(--gold)',
            ico: '💰', num: fmtBig(rd), numCls: 'kpi-num-md',
            foot: `<span class="muted">DY médio: </span><strong>${(dyM * 100).toFixed(3)}% / mês</strong>`,
            delta: { v: dyM * 1200, cls: 'd-nt', txt: '~' + (dyM * 1200).toFixed(1) + '% a.a.' },
            delay: .14,
        },
        {
            lbl: 'P/VP MÉDIO', tag: 'CARTEIRA',
            accent: pvM < 1 ? 'linear-gradient(90deg,#22d47e,#4da6ff)' : 'linear-gradient(90deg,#f05454,#a78bfa)',
            glow: pvM < 1 ? 'rgba(34,212,126,.06)' : 'rgba(240,84,84,.06)',
            ibg: pvM < 1 ? 'rgba(34,212,126,.12)' : 'rgba(240,84,84,.12)',
            tbg: pvM < 1 ? 'var(--gbg)' : 'var(--rbg)', tc: pvM < 1 ? 'var(--green)' : 'var(--red)',
            ico: '⚖️', num: pvM.toFixed(3), numCls: '',
            foot: `<strong>${nDisc}</strong><span class="muted"> de ${D.length} fundos com desconto</span>`,
            delta: null,
            note: { txt: pvM < 1 ? '🟢 Desconto médio' : '🔴 Prêmio médio', clr: pvM < 1 ? 'var(--green)' : 'var(--red)' },
            delay: .21,
        },
    ];

    document.getElementById('kpiGrid').innerHTML = cards.map(k => `
    <div class="kpi" style="animation-delay:${k.delay}s;--accent:${k.accent}">
      <div class="kpi-glow" style="--glow:${k.glow}"></div>
      <div class="kpi-head">
        <div>
          <div class="kpi-lbl">${k.lbl}</div>
          <div class="kpi-subtag" style="--tbg:${k.tbg};--tc:${k.tc};background:${k.tbg};color:${k.tc}">${k.tag}</div>
        </div>
        <div class="kpi-ico" style="background:${k.ibg}">${k.ico}</div>
      </div>
      <div class="kpi-num ${k.numCls}">${k.num}</div>
      <div class="kpi-foot">
        ${k.foot}
        ${k.delta ? `<span class="delta ${k.delta.cls}">${k.delta.txt}</span>` : ''}
        ${k.note ? `<span class="kpi-note" style="color:${k.note.clr}">${k.note.txt}</span>` : ''}
      </div>
    </div>
  `).join('');
}

// ── AI Chips ───────────────────────────────────────────────────────────────
export function renderAIChips(ALL) {
    const el = document.getElementById('aiChips');
    if (!el) return;
    el.innerHTML = ALL.map(d => {
        const has = d.aSeg || d.aCat || d.aPv;
        const t = d.aTr === 'alta' ? '↗' : d.aTr === 'baixa' ? '↘' : '→';
        return `<span class="ch ${has ? 'ch-live' : 'ch-off'}">${d.tk} ${t}</span>`;
    }).join('');
}

// ── Tabela Principal ───────────────────────────────────────────────────────
export function renderTable(FIL) {
    const aiWrap = (val, isAI) => isAI
        ? `${val}<sup style="color:var(--purple);font-size:9px;margin-left:2px;font-family:var(--mono)">AI</sup>`
        : val;

    document.getElementById('tBody').innerHTML = FIL.map(d => {
        const seg = d.aSeg || d.seg;
        const cat = d.aCat || d.cat;
        const catU = cat.toUpperCase();
        const catCls = catU.includes('PAPEL') ? 'cat-p'
            : catU.includes('TIJOLO') ? 'cat-t'
                : (catU.includes('FOF') || catU.includes('FUNDO')) ? 'cat-f'
                    : catU.includes('FIAGRO') ? 'cat-a'
                        : (catU.includes('HIBRID') || catU.includes('HÍBRID')) ? 'cat-h' : 'cat-d';

        const catAbbr = catU.includes('PAPEL') ? 'Papel'
            : catU.includes('TIJOLO') ? 'Tijolo'
                : (catU.includes('FOF') || catU.includes('FUNDO DE FUNDO')) ? 'FoF'
                    : catU.includes('FIAGRO') ? 'Fiagro'
                        : (catU.includes('HIBRID') || catU.includes('HÍBRID')) ? 'Híbrido'
                            : cat.length > 12 ? cat.slice(0, 11) + '…' : cat;

        const segAbbr = seg.length > 18 ? seg.slice(0, 17) + '…' : seg;
        const pvp = d.aPv || d.pv;
        const dy = d.aDy || d.dy;
        const re = d.aRe || d.re;
        const pr = d.aVl || d.vl;
        const pvCls = pvp < 0.95 ? 'pos' : pvp > 1.05 ? 'neg' : 'muted';
        const tr = d.aTr === 'alta' ? '↗' : d.aTr === 'baixa' ? '↘' : '→';
        const tc = d.aTr === 'alta' ? 'var(--green)' : d.aTr === 'baixa' ? 'var(--red)' : 'var(--text3)';

        return `<tr>
      <td><span class="tk"><span style="color:${tc}">${tr}</span>${d.tk}</span></td>
      <td style="font-size:12px;max-width:110px;overflow:hidden;text-overflow:ellipsis" class="${d.aSeg ? 'pos' : 'muted'}" title="${seg}">${segAbbr}</td>
      <td title="${cat}"><span class="ct2 ${catCls}">${d.aCat ? '★ ' : ''}${catAbbr}</span></td>
      <td class="mono">${d.co.toLocaleString('pt-BR')}</td>
      <td class="mono">${fmt(d.pm)}</td>
      <td class="mono">${aiWrap(fmt(pr), !!d.aVl)}</td>
      <td class="mono ${pvCls}">${aiWrap(pvp.toFixed(3), !!d.aPv)}</td>
      <td class="mono">${aiWrap((dy * 100).toFixed(3) + '%', !!d.aDy)}</td>
      <td class="mono">${aiWrap(fmt(re), !!d.aRe)}</td>
      <td class="mono">${fmt(d.tp)}</td>
      <td class="mono">${fmt(d.ta)}</td>
      <td class="mono ${d.df >= 0 ? 'pos' : 'neg'}">${d.df >= 0 ? '+' : ''}${fmt(d.df)}</td>
      <td class="mono pos">${fmt(d.pr)}</td>
      <td class="mono bold ${d.rl >= 0 ? 'pos' : 'neg'}">${d.rl >= 0 ? '+' : ''}${fmt(d.rl)}</td>
    </tr>`;
    }).join('');
}
