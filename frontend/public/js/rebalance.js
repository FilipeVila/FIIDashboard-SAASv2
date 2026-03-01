/**
 * rebalance.js — Motor de Rebalanceamento v2.1
 *
 * Score Ponderado Normalizado:
 *   Score = 0.35·ΔDY_N + 0.25·DY_N + 0.20·PVP_N + bônus/penalização
 *
 * Fluxo: Whitelist → Filtro Valuation → Normalização → Score → Seleção
 */
import { fmt, fmtBig } from './render.js';

// ── Configuração da Estratégia ─────────────────────────────────────────────
const RB_PRIORITY = ['MXRF11', 'XPML11', 'KNRI11', 'ALZR11', 'HGLG11', 'XPLG11', 'KNCR11'];
const RB_SELL = ['KISU11', 'PCIP11', 'BTHF11', 'CYCR11'];
export const RB_DY_MIN = 0.01;   // 1% ao mês
export const RB_TIJOLO_MIN = 0.40;   // 40% mínimo em tijolo
const SCORE_MIN = 0.2;

const rankEmoji = ['🥇', '🥈', '🥉'];

// ── Helpers ────────────────────────────────────────────────────────────────
const cotaTeto = (preco) => preco < 30 ? 1000 : 100;
const cotasAtuais = (d) => d.co || 0;

export function classifyFii(d) {
    if (RB_SELL.includes(d.tk)) return 'sell';
    if (RB_PRIORITY.includes(d.tk)) return 'priority';
    return 'neutral';
}

export function isTijolo(d) {
    const cat = (d.aCat || d.cat || '').toUpperCase();
    return cat.includes('TIJOLO');
}

function _normalizar(arr, key) {
    const vals = arr.map(m => m[key]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    arr.forEach(m => { m[key + '_N'] = (mx === mn) ? 1 : (m[key] - mn) / (mx - mn); });
}

/**
 * Valida inputs, exibe diagnóstico e aciona computeRebalance.
 * @param {object[]} ALL - Array completo de FIIs
 */
export function runRebalance(ALL) {
    if (!ALL.length) { alert('Carregue uma planilha primeiro.'); return; }
    const metaRaw = parseFloat(document.getElementById('rbMeta')?.value) || 850;
    const aporteRaw = parseFloat(document.getElementById('rbAporte')?.value) || 907.80;
    const meta = Math.max(0, Math.min(metaRaw, 999999));
    const aporte = Math.max(0, Math.min(aporteRaw, 999999));

    document.getElementById('rbPlaceholder').style.display = 'none';
    document.getElementById('rbDiag').style.display = 'block';
    const btn = document.getElementById('rbRunBtn');
    const ico = document.getElementById('rbRunIco');
    if (btn) btn.disabled = true;
    if (ico) ico.textContent = '⏳';

    setTimeout(() => {
        try { computeRebalance(ALL, meta, aporte); }
        finally {
            if (btn) btn.disabled = false;
            if (ico) ico.textContent = '⚡';
        }
    }, 60);
}

/**
 * Motor de decisão v2.1 — executa análise completa e atualiza DOM.
 */
export function computeRebalance(D, meta, aporte) {
    const totalInvestido = D.reduce((s, d) => s + d.tp, 0);
    const totalAtual = D.reduce((s, d) => s + d.ta, 0);
    const rendaMensal = D.reduce((s, d) => s + (d.ga || 0), 0);
    const dyArr = D.map(d => d.aDy || d.dy).filter(v => v > 0);
    const dyMedio = dyArr.length ? dyArr.reduce((a, b) => a + b, 0) / dyArr.length : 0;
    const totalTijolo = D.filter(isTijolo).reduce((s, d) => s + d.ta, 0);
    const pctTijolo = totalAtual > 0 ? totalTijolo / totalAtual : 0;
    const pctAtingido = meta > 0 ? Math.min(rendaMensal / meta, 1) : 1;
    const faltaMeta = Math.max(meta - rendaMensal, 0);
    const DYCarteira = totalAtual > 0 ? rendaMensal / totalAtual : 0;
    const dySimulado = Math.max(dyMedio, 0.008);

    // ── Simulação de crescimento ───────────────────────────────────────────
    let meses = 0, patrimonioSim = totalAtual, rendaSim = rendaMensal;
    while (rendaSim < meta && meses < 600) {
        patrimonioSim += aporte + rendaSim;
        rendaSim = patrimonioSim * dySimulado;
        meses++;
    }
    const anos = Math.floor(meses / 12), mesesRest = meses % 12;
    const patrimonioNecessario = meta > 0 && dySimulado > 0 ? meta / dySimulado : 0;

    // ── Diagnóstico cards ──────────────────────────────────────────────────
    _renderDiagCards(D, rendaMensal, meta, faltaMeta, dyMedio, pctTijolo, totalAtual, totalInvestido, aporte);

    // ── Progresso da meta ─────────────────────────────────────────────────
    const pct = Math.round(pctAtingido * 100);
    const rbProgPct = document.getElementById('rbProgPct');
    const rbProgBar = document.getElementById('rbProgBar');
    const rbProgMeta = document.getElementById('rbProgMeta');
    const rbProgLeft = document.getElementById('rbProgLeft');
    if (rbProgPct) rbProgPct.textContent = pct + '%';
    if (rbProgBar) rbProgBar.style.width = pct + '%';
    if (rbProgMeta) rbProgMeta.textContent = fmt(meta) + '/mês';
    if (rbProgLeft) rbProgLeft.textContent = rendaMensal >= meta ? '🎉 Meta atingida!' : `Faltam ${fmt(faltaMeta)}/mês`;

    // ── Simulação grid ────────────────────────────────────────────────────
    const rbSimGrid = document.getElementById('rbSimGrid');
    if (rbSimGrid) rbSimGrid.innerHTML = `
    <div class="rb-sim-item"><div class="rb-sim-num">${meses >= 600 ? '∞' : (anos > 0 ? anos + 'a ' + mesesRest + 'm' : mesesRest + 'm')}</div><div class="rb-sim-lbl">Tempo estimado</div></div>
    <div class="rb-sim-item"><div class="rb-sim-num">${fmtBig(patrimonioNecessario)}</div><div class="rb-sim-lbl">Patrimônio necessário</div></div>
    <div class="rb-sim-item"><div class="rb-sim-num">${(dySimulado * 100).toFixed(2)}%</div><div class="rb-sim-lbl">DY simulado/mês</div></div>
    <div class="rb-sim-item"><div class="rb-sim-num">${fmtBig(aporte + rendaMensal)}</div><div class="rb-sim-lbl">Reinvestimento/mês</div></div>
  `;

    // ── Alertas automáticos ───────────────────────────────────────────────
    _renderAlerts(D, dyMedio, pctTijolo, rendaMensal, meta, faltaMeta);

    // ── Motor de Decisão v2.1 ─────────────────────────────────────────────
    const { ordens, candidatos, camadaLabel, camadaCor } = _runDecisionEngine(D, totalAtual, rendaMensal, DYCarteira, aporte, pctTijolo);

    // ── Render Decisão ────────────────────────────────────────────────────
    _renderDecision(ordens, candidatos, camadaLabel, camadaCor, DYCarteira, aporte);

    // ── Classificação FIIs ────────────────────────────────────────────────
    _renderFiiList(D, ordens, candidatos);
}

// ── Motor de Decisão Interno ───────────────────────────────────────────────
function _runDecisionEngine(D, totalAtual, rendaMensal, DYCarteira, aporte, pctTijolo) {
    const universo = D.filter(d => RB_PRIORITY.includes(d.tk));

    let elegíveis = universo.filter(d => (d.aPv || d.pv) < 1);
    let camadaLabel = '🟢 Camada Primária (P/VP < 1)';
    let camadaCor = 'var(--green)';

    if (elegíveis.length === 0) {
        elegíveis = universo.filter(d => {
            const pvp = d.aPv || d.pv;
            const dy = d.aDy || d.dy || 0;
            return pvp <= 1.03 && dy >= DYCarteira + 0.0005;
        });
        camadaLabel = '🟡 Camada Secundária (P/VP ≤ 1.03 + DY ≥ Global+0.05%)';
        camadaCor = 'var(--gold)';
    }

    const candidatos = elegíveis.map(d => {
        const pvp = d.aPv || d.pv || 0;
        const dyFii = d.aDy || d.dy || 0;
        const preco = d.aVl || d.vl || 0;
        const rendaNova = aporte * dyFii;
        const novoDY = totalAtual > 0 ? (rendaMensal + rendaNova) / (totalAtual + aporte) : dyFii;
        const crescDY = novoDY - DYCarteira;
        const distAtual = Math.max(RB_DY_MIN - DYCarteira, 0);
        const distNova = Math.max(RB_DY_MIN - novoDY, 0);
        const redDistMeta = distAtual - distNova;
        const bonusTijolo = (isTijolo(d) && pctTijolo < RB_TIJOLO_MIN) ? 0.1 : 0;
        const alvo = cotaTeto(preco);
        const penalConc = cotasAtuais(d) > alvo * 1.2 ? 0.1 : 0;
        return { d, pvp, dyFii, preco, novoDY, crescDY, redDistMeta, bonusTijolo, penalConc };
    });

    if (candidatos.length > 0) {
        _normalizar(candidatos, 'crescDY');
        candidatos.forEach(m => { m.pvpInv = 1 - m.pvp; });
        _normalizar(candidatos, 'dyFii');
        _normalizar(candidatos, 'pvpInv');
    }

    candidatos.forEach(m => {
        m.score = (0.35 * (m.crescDY_N || 0))
            + (0.25 * (m.dyFii_N || 0))
            + (0.20 * (m.pvpInv_N || 0))
            + (0.10 * m.bonusTijolo)
            - (0.10 * m.penalConc);
    });
    candidatos.sort((a, b) => b.score - a.score);

    const vencedor = candidatos.length > 0 && candidatos[0].score >= SCORE_MIN ? candidatos[0] : null;

    const ordens = [];
    if (vencedor) {
        const m = vencedor;
        const cotasComSaldo = Math.floor(aporte / m.preco);
        if (cotasComSaldo >= 1) {
            const tetoFii = cotaTeto(m.preco);
            const cotasAntes = cotasAtuais(m.d);
            const cotasDepois = cotasAntes + cotasComSaldo;
            const valorGasto = cotasComSaldo * m.preco;
            const rendaExtra = cotasComSaldo * (m.d.aRe || m.d.re || 0);
            ordens.push({
                d: m.d, preco: m.preco, cotas: cotasComSaldo, valor: valorGasto,
                rendaExtra, deltaDY: m.crescDY, novoDY: m.novoDY,
                dyFii: m.dyFii, pvp: m.pvp, score: m.score,
                bonusTijolo: m.bonusTijolo, penalConc: m.penalConc,
                redDistMeta: m.redDistMeta, tetoFii, cotasAntes, cotasDepois,
                camadaLabel,
            });
        }
    }

    return { ordens, candidatos, camadaLabel, camadaCor };
}

// ── Funções de Render Internas ─────────────────────────────────────────────
function _renderDiagCards(D, rendaMensal, meta, faltaMeta, dyMedio, pctTijolo, totalAtual, totalInvestido, aporte) {
    const diagCards = [
        {
            lbl: 'Renda Mensal Atual', val: fmt(rendaMensal), sub: `Meta: ${fmt(meta)}`,
            badge: rendaMensal >= meta
                ? { txt: '✅ Meta atingida', bg: 'rgba(34,212,126,.12)', c: 'var(--green)' }
                : { txt: `Faltam ${fmt(faltaMeta)}`, bg: 'rgba(240,84,84,.12)', c: 'var(--red)' },
            accent: rendaMensal >= meta ? 'var(--green)' : 'var(--red)',
        },
        {
            lbl: 'DY Médio Carteira', val: (dyMedio * 100).toFixed(3) + '%/mês', sub: `${(dyMedio * 1200).toFixed(1)}% ao ano`,
            badge: dyMedio >= RB_DY_MIN
                ? { txt: '✅ Acima de 1%/mês', bg: 'rgba(34,212,126,.12)', c: 'var(--green)' }
                : { txt: '⚠️ Abaixo de 1%/mês', bg: 'rgba(245,197,66,.12)', c: 'var(--gold)' },
            accent: dyMedio >= RB_DY_MIN ? 'var(--green)' : 'var(--gold)',
        },
        {
            lbl: '% em Tijolo', val: (pctTijolo * 100).toFixed(1) + '%', sub: `Mínimo recomendado: 40%`,
            badge: pctTijolo >= RB_TIJOLO_MIN
                ? { txt: '✅ Estrutura OK', bg: 'rgba(34,212,126,.12)', c: 'var(--green)' }
                : { txt: '⚠️ Abaixo de 40%', bg: 'rgba(245,197,66,.12)', c: 'var(--gold)' },
            accent: pctTijolo >= RB_TIJOLO_MIN ? 'var(--green)' : 'var(--gold)',
        },
        { lbl: 'Patrimônio Total', val: fmtBig(totalAtual), sub: `Investido: ${fmtBig(totalInvestido)}`, badge: null, accent: 'var(--blue)' },
        { lbl: 'FIIs com P/VP < 1', val: D.filter(d => (d.aPv || d.pv) < 1).length + ' fundos', sub: `De ${D.length} na carteira`, badge: null, accent: 'var(--purple)' },
        {
            lbl: 'Próximo Aporte', val: fmt(aporte), sub: `+ ${fmt(D.reduce((s, d) => s + (d.ga || 0), 0))} em dividendos`,
            badge: { txt: `Total: ${fmt(aporte + rendaMensal)}`, bg: 'rgba(77,166,255,.12)', c: 'var(--blue)' },
            accent: 'var(--teal)',
        },
    ];

    const el = document.getElementById('rbDiagGrid');
    if (el) el.innerHTML = diagCards.map(c => `
    <div class="rb-diag-card" style="--dc-accent:${c.accent}">
      <div class="rb-dc-lbl">${c.lbl}</div>
      <div class="rb-dc-val">${c.val}</div>
      <div class="rb-dc-sub">${c.sub}</div>
      ${c.badge ? `<div class="rb-dc-badge" style="background:${c.badge.bg};color:${c.badge.c}">${c.badge.txt}</div>` : ''}
    </div>
  `).join('');
}

function _renderAlerts(D, dyMedio, pctTijolo, rendaMensal, meta, faltaMeta) {
    const alerts = [];
    if (dyMedio < RB_DY_MIN) alerts.push({ type: 'warn', ico: '⚠️', msg: `<strong>DY médio abaixo de 1%/mês</strong> — ${(dyMedio * 100).toFixed(2)}%/mês. Priorize FIIs de alto DY.` });
    if (pctTijolo < RB_TIJOLO_MIN) alerts.push({ type: 'warn', ico: '⚠️', msg: `<strong>Exposição em Tijolo abaixo de 40%</strong> — atual: ${(pctTijolo * 100).toFixed(1)}%.` });
    const sellOwned = D.filter(d => RB_SELL.includes(d.tk));
    if (sellOwned.length) alerts.push({ type: 'danger', ico: '🚫', msg: `<strong>Atenção:</strong> ${sellOwned.map(d => d.tk).join(', ')} marcados como <strong>somente venda</strong>. Não aporte.` });
    const lowDyFiis = D.filter(d => (d.aDy || d.dy) > 0 && (d.aDy || d.dy) < RB_DY_MIN && !RB_SELL.includes(d.tk));
    if (lowDyFiis.length) alerts.push({ type: 'warn', ico: '📉', msg: `<strong>${lowDyFiis.map(d => d.tk).join(', ')}</strong> com DY abaixo de 1%/mês. Monitore.` });
    if (rendaMensal >= meta) alerts.push({ type: 'ok', ico: '🎉', msg: `<strong>Parabéns!</strong> Renda de ${fmt(rendaMensal)} atingiu a meta de ${fmt(meta)}/mês.` });

    const el = document.getElementById('rbAlerts');
    if (el) el.innerHTML = alerts.map(a => `
    <div class="rb-alert ${a.type}"><div class="rb-alert-ico">${a.ico}</div><div class="rb-alert-body">${a.msg}</div></div>
  `).join('');
}

function _renderDecision(ordens, candidatos, camadaLabel, camadaCor, DYCarteira, aporte) {
    const el = document.getElementById('rbDecision');
    if (!el) return;

    if (!ordens.length) {
        const motivo = candidatos.length === 0
            ? 'Nenhum FII da whitelist passou no filtro de valuation.'
            : `Score máximo = ${candidatos[0].score.toFixed(3)} &lt; 0.200 — aguardar melhor oportunidade.`;
        el.innerHTML = `
      <div style="background:rgba(240,84,84,.06);border:1px solid rgba(240,84,84,.25);border-radius:var(--rs);padding:24px 28px;text-align:center">
        <div style="font-size:32px;margin-bottom:12px">🏦</div>
        <div style="font-size:16px;font-weight:800;color:var(--red);margin-bottom:8px">Aguardar — Nenhum FII elegível</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.8">
          DY_global atual: <strong style="color:var(--blue)">${(DYCarteira * 100).toFixed(3)}%/mês</strong><br>
          ${motivo}<br><br>
          <span style="color:var(--gold)">⏳ Motor v2.1: preservando a saúde da carteira. Manter caixa.</span>
        </div>
      </div>`;
        return;
    }

    const totalGasto = ordens.reduce((s, o) => s + o.valor, 0);
    const totalCotas = ordens.reduce((s, o) => s + o.cotas, 0);
    const totalRenda = ordens.reduce((s, o) => s + o.rendaExtra, 0);
    const troco = aporte - totalGasto;
    const o0 = ordens[0];

    el.innerHTML = `
    <div class="rb-order-wrap">
      <div class="rb-order-header">
        <div>
          <div class="rb-order-title">📋 Ordem de Compra — Motor v2.1 Score Ponderado</div>
          <div class="rb-order-subtitle">Score = 0.35·ΔDY + 0.25·DY + 0.20·P/VP + Estrutura &nbsp;·&nbsp;
            <strong style="color:${camadaCor}">${camadaLabel}</strong>
          </div>
        </div>
        <div class="rb-order-budget">
          <div class="rb-order-budget-lbl">Disponível</div>
          <div class="rb-order-budget-val">${fmt(aporte)}</div>
        </div>
      </div>

      <div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:14px 18px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3);font-family:var(--mono);margin-bottom:10px">
          ANÁLISE DE SCORE — ${o0.d.tk}
          ${o0.bonusTijolo > 0 ? '<span style="color:var(--teal);margin-left:8px">+Tijolo</span>' : ''}
          ${o0.penalConc > 0 ? '<span style="color:var(--gold);margin-left:8px">⚠ Conc.</span>' : ''}
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap">
          <span style="font-size:12px;font-family:var(--mono);color:var(--text2)">DY_global: <strong>${(DYCarteira * 100).toFixed(4)}%</strong></span>
          <span style="font-size:12px;font-family:var(--mono);color:var(--green)">→ Novo DY: <strong>${(o0.novoDY * 100).toFixed(4)}%</strong></span>
          <span style="font-size:12px;font-family:var(--mono);color:var(--blue)">ΔDY: <strong style="color:${o0.deltaDY >= 0 ? 'var(--green)' : 'var(--red)'}">${o0.deltaDY > 0 ? '+' : ''}${(o0.deltaDY * 100).toFixed(5)}%</strong></span>
          <span style="font-size:13px;font-family:var(--mono);font-weight:800;color:var(--purple)">⭐ Score: ${o0.score.toFixed(3)}</span>
        </div>
      </div>

      <table class="rb-order-table">
        <thead><tr>
          <th>#</th><th>Fundo</th><th>Tipo</th><th>P/VP</th><th>DY/mês</th>
          <th>Score</th><th>ΔDY global</th><th>Preço/cota</th><th>Cotas</th>
          <th>Qtd atual → após</th><th>Valor total</th><th>+Renda/mês</th>
        </tr></thead>
        <tbody>
          ${ordens.map((o, i) => {
        const catU = (o.d.aCat || o.d.cat || '').toUpperCase();
        const tipo = catU.includes('PAPEL') ? 'Papel' : catU.includes('TIJOLO') ? 'Tijolo' : (catU.includes('FOF') || catU.includes('FUNDO')) ? 'FoF' : catU.includes('FIAGRO') ? 'Fiagro' : '—';
        const pctTeto = Math.min(o.cotasDepois / o.tetoFii * 100, 999);
        const tetoColor = pctTeto > 120 ? 'var(--gold)' : pctTeto >= 100 ? 'var(--blue)' : 'var(--text3)';
        return `<tr>
              <td class="rb-order-rank">${rankEmoji[i] || '·'}</td>
              <td><span style="font-family:var(--mono);font-weight:800;font-size:14px;color:var(--green)">${o.d.tk}</span></td>
              <td><span style="font-size:11px;padding:2px 7px;border-radius:20px;font-family:var(--mono);font-weight:700;background:${catU.includes('TIJOLO') ? 'rgba(34,212,126,.12)' : 'rgba(77,166,255,.12)'};color:${catU.includes('TIJOLO') ? 'var(--green)' : 'var(--blue)'}">${tipo}</span></td>
              <td style="font-family:var(--mono);font-weight:700;color:${o.pvp < 1 ? 'var(--green)' : o.pvp > 1.05 ? 'var(--red)' : 'var(--text)'}">${o.pvp.toFixed(3)}</td>
              <td style="font-family:var(--mono);color:${o.dyFii >= RB_DY_MIN ? 'var(--green)' : 'var(--gold)'}">${(o.dyFii * 100).toFixed(3)}%</td>
              <td style="font-family:var(--mono);font-weight:800;color:var(--purple)">${o.score.toFixed(3)}</td>
              <td style="font-family:var(--mono);font-weight:800;color:var(--green)">${o.deltaDY > 0 ? '+' : ''}${(o.deltaDY * 100).toFixed(5)}%</td>
              <td style="font-family:var(--mono)">${fmt(o.preco)}</td>
              <td style="font-family:var(--mono);font-weight:800;font-size:16px;color:var(--blue)">${o.cotas}</td>
              <td style="font-family:var(--mono);font-size:11px">
                <span style="color:var(--text2)">${o.cotasAntes}</span>
                <span style="color:var(--text3)"> → </span>
                <span style="color:${tetoColor};font-weight:700">${o.cotasDepois}</span>
                <span style="color:var(--text3)"> / ${o.tetoFii}</span>
                ${o.penalConc > 0 ? '<span style="color:var(--gold);margin-left:3px" title="Acima de 120% do alvo">⚠</span>' : ''}
              </td>
              <td style="font-family:var(--mono);font-weight:700">${fmt(o.valor)}</td>
              <td style="font-family:var(--mono);font-weight:700;color:var(--green)">+${fmt(o.rendaExtra)}</td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>

      <div class="rb-order-summary">
        <div class="rb-order-sum-item"><div class="rb-order-sum-lbl">Total da compra</div><div class="rb-order-sum-val">${fmt(totalGasto)}</div><div class="rb-order-sum-sub">${totalCotas} cota${totalCotas !== 1 ? 's' : ''}</div></div>
        <div class="rb-order-sum-item"><div class="rb-order-sum-lbl">Troco / Sobra</div><div class="rb-order-sum-val" style="color:${troco > 0 ? 'var(--gold)' : 'var(--text2)'}">${fmt(troco)}</div><div class="rb-order-sum-sub">${troco > 0 ? 'guardar para próximo' : '100% utilizado'}</div></div>
        <div class="rb-order-sum-item"><div class="rb-order-sum-lbl">+Renda mensal</div><div class="rb-order-sum-val" style="color:var(--green)">+${fmt(totalRenda)}</div><div class="rb-order-sum-sub">após esta compra</div></div>
        <div class="rb-order-sum-item"><div class="rb-order-sum-lbl">Novo DY Carteira</div><div class="rb-order-sum-val" style="color:${o0.novoDY >= RB_DY_MIN ? 'var(--green)' : 'var(--gold)'}">${(o0.novoDY * 100).toFixed(3)}%</div><div class="rb-order-sum-sub">meta: 1.000%/mês</div></div>
      </div>
    </div>
  `;
}

function _renderFiiList(D, ordens, candidatos) {
    const recTks = new Set(ordens.map(o => o.d.tk));
    const sorted = [...D].sort((a, b) => {
        const order = { priority: 0, neutral: 1, sell: 2 };
        const ca = classifyFii(a), cb = classifyFii(b);
        if (order[ca] !== order[cb]) return order[ca] - order[cb];
        return (b.aDy || b.dy) - (a.aDy || a.dy);
    });

    const el = document.getElementById('rbFiiList');
    if (!el) return;
    el.innerHTML = sorted.map(d => {
        const cls = classifyFii(d);
        const pvp = d.aPv || d.pv;
        const dy = d.aDy || d.dy;
        const preco = d.aVl || d.vl || 0;
        const isPrio = cls === 'priority', isSell = cls === 'sell';
        const orderIdx = ordens.findIndex(o => o.d.tk === d.tk);
        const ordem = orderIdx >= 0 ? ordens[orderIdx] : null;
        const scoredItem = candidatos.find(s => s.d.tk === d.tk);
        const acimaTeto = preco > 0 && cotasAtuais(d) > cotaTeto(preco) * 1.2;
        const isRec = recTks.has(d.tk);

        let badge, badgeCls;
        if (isSell) { badge = '🚫 VENDA'; badgeCls = 'rb-badge-sell'; }
        else if (isRec) { badge = `${rankEmoji[orderIdx] || '✅'} COMPRAR`; badgeCls = 'rb-badge-buy'; }
        else if (acimaTeto) { badge = '⚠ CONC.'; badgeCls = 'rb-badge-hold'; }
        else if (isPrio && pvp < 1) { badge = '⭐ PRIORITÁRIO'; badgeCls = 'rb-badge-buy'; }
        else if (isPrio) { badge = '⭐ PRIORITÁRIO'; badgeCls = 'rb-badge-prio'; }
        else { badge = 'NEUTRO'; badgeCls = 'rb-badge-hold'; }

        const rowCls = isSell ? 'rb-sell' : isPrio ? 'rb-priority' : 'rb-neutral';
        let reason = '';
        if (isSell) reason = 'Não aportar — lista de venda';
        else if (ordem) {
            const pctT = Math.min(ordem.cotasDepois / ordem.tetoFii * 100, 999);
            reason = `${ordem.cotas} cota${ordem.cotas !== 1 ? 's' : ''} × ${fmt(ordem.preco)} = <strong>${fmt(ordem.valor)}</strong><br><span style="color:var(--text3);font-size:10px">Score: ${ordem.score.toFixed(3)} · ${ordem.cotasDepois}/${ordem.tetoFii} (${pctT.toFixed(0)}%)</span>`;
        }
        else if (!RB_PRIORITY.includes(d.tk)) reason = 'Fora da whitelist — não elegível';
        else if (pvp > 1.03) reason = `P/VP ${pvp.toFixed(3)} — fora do filtro`;
        else if (pvp >= 1 && pvp <= 1.03) reason = `P/VP ${pvp.toFixed(3)} — camada secundária`;
        else reason = `P/VP ${pvp.toFixed(3)} — saldo insuficiente`;

        return `<div class="rb-fii-row ${rowCls}" ${isRec ? 'style="border-color:rgba(34,212,126,.5);box-shadow:0 0 0 1px rgba(34,212,126,.12)"' : ''}>
      <div class="rb-fii-tk" style="${isSell ? 'color:var(--red)' : isRec ? 'color:var(--green)' : isPrio ? 'color:var(--purple)' : ''}">${isRec ? (rankEmoji[orderIdx] || '▶') + ' ' : ''}${d.tk}</div>
      <span class="rb-fii-badge ${badgeCls}">${badge}</span>
      <div class="rb-fii-stats">
        <span class="rb-fii-stat">P/VP <strong style="color:${pvp < 1 ? 'var(--green)' : pvp > 1.05 ? 'var(--red)' : 'var(--text)'}">${pvp.toFixed(3)}</strong></span>
        <span class="rb-fii-stat">DY <strong>${(dy * 100).toFixed(2)}%</strong></span>
        ${scoredItem ? `<span class="rb-fii-stat">Score <strong style="color:var(--blue)">${scoredItem.score.toFixed(3)}</strong></span>` : ''}
        <span class="rb-fii-stat">Renda <strong style="color:var(--gold)">${fmt(d.ga)}</strong></span>
        <span class="rb-fii-stat">Cotas <strong>${cotasAtuais(d)}/${preco > 0 ? cotaTeto(preco) : '—'}</strong></span>
      </div>
      <div class="rb-fii-reason">${reason}</div>
    </div>`;
    }).join('');
}
