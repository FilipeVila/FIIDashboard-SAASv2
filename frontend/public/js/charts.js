/**
 * charts.js — Gráficos Chart.js (Resultado Real, Categoria, Renda, P/VP)
 */
import { isDark } from './ui.js';

/**
 * Destrói gráficos existentes e reconstrói com os dados filtrados.
 * @param {object[]} FIL - Array filtrado de FIIs
 * @param {object} CHARTS - Objeto para guardar referências {r, c, rd, pv}
 */
export function rebuildCharts(FIL, CHARTS) {
    // Destrói instâncias anteriores para evitar vazamento de memória
    Object.values(CHARTS).forEach(c => { try { c.destroy(); } catch { } });
    Object.keys(CHARTS).forEach(k => delete CHARTS[k]);

    if (!FIL.length) return;

    const dk = isDark();
    const tc = dk ? '#7a849e' : '#4b5563';
    const gc = dk ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)';
    Chart.defaults.color = tc;
    Chart.defaults.borderColor = gc;
    Chart.defaults.font = { family: "'JetBrains Mono',monospace", size: 11 };

    const fmt = (v) => 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ── Resultado Real ──────────────────────────────────────────────────────
    const s1 = [...FIL].sort((a, b) => b.rl - a.rl);
    CHARTS.r = new Chart(document.getElementById('cRes'), {
        type: 'bar',
        data: {
            labels: s1.map(d => d.tk),
            datasets: [{
                data: s1.map(d => d.rl),
                borderRadius: 8,
                borderSkipped: false,
                backgroundColor: s1.map(d => d.rl >= 0 ? 'rgba(34,212,126,.7)' : 'rgba(240,84,84,.7)'),
                borderColor: s1.map(d => d.rl >= 0 ? '#22d47e' : '#f05454'),
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ' R$ ' + c.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) } },
            },
            scales: {
                y: { grid: { color: gc }, ticks: { callback: v => 'R$' + v.toLocaleString('pt-BR') } },
                x: { grid: { display: false } },
            },
        },
    });

    // ── Donut: Patrimônio por Categoria ────────────────────────────────────
    const cm = {};
    FIL.forEach(d => { const c = d.aCat || d.cat; cm[c] = (cm[c] || 0) + d.ta; });
    const clrs = ['#22d47e', '#4da6ff', '#a78bfa', '#f5c542', '#f05454', '#2dd4bf', '#ff8c42'];
    const total = Object.values(cm).reduce((a, b) => a + b, 0);
    CHARTS.c = new Chart(document.getElementById('cCat'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(cm),
            datasets: [{ data: Object.values(cm), backgroundColor: clrs, borderWidth: 3, borderColor: dk ? '#0e1220' : '#fff' }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: { callbacks: { label: c => ` R$ ${c.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${(c.raw / total * 100).toFixed(1)}%)` } },
            },
        },
    });

    // ── Renda Mensal ────────────────────────────────────────────────────────
    const s3 = [...FIL].sort((a, b) => b.ga - a.ga);
    CHARTS.rd = new Chart(document.getElementById('cRenda'), {
        type: 'bar',
        data: {
            labels: s3.map(d => d.tk),
            datasets: [{
                data: s3.map(d => d.ga),
                borderRadius: 8,
                borderSkipped: false,
                backgroundColor: 'rgba(245,197,66,.7)',
                borderColor: '#f5c542',
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` R$ ${c.raw.toFixed(2)}` } },
            },
            scales: {
                y: { grid: { color: gc }, ticks: { callback: v => 'R$' + v.toFixed(0) } },
                x: { grid: { display: false } },
            },
        },
    });

    // ── P/VP ────────────────────────────────────────────────────────────────
    const s4 = [...FIL].sort((a, b) => (b.aPv || b.pv) - (a.aPv || a.pv));
    const pvs = s4.map(d => d.aPv || d.pv);
    CHARTS.pv = new Chart(document.getElementById('cPvp'), {
        type: 'bar',
        data: {
            labels: s4.map(d => d.tk),
            datasets: [{
                data: pvs,
                borderRadius: 8,
                borderSkipped: false,
                backgroundColor: pvs.map(v => v < 0.95 ? 'rgba(34,212,126,.7)' : v > 1.05 ? 'rgba(240,84,84,.7)' : 'rgba(77,166,255,.7)'),
                borderColor: pvs.map(v => v < 0.95 ? '#22d47e' : v > 1.05 ? '#f05454' : '#4da6ff'),
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` P/VP: ${c.raw.toFixed(3)}` } },
            },
            scales: {
                y: { grid: { color: gc }, min: .75, max: 1.15, ticks: { callback: v => v.toFixed(2) } },
                x: { grid: { display: false } },
            },
        },
    });
}
