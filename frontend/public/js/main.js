/**
 * main.js — Orquestrador do FIIDashboard SaaS v2
 *
 * Responsabilidades únicas deste módulo:
 * - Importar todos os módulos ES6
 * - Manter estado global (ALL, FIL, CHARTS)
 * - Registrar event listeners no DOMContentLoaded
 * - Coordenar o fluxo: upload → parse → enrich → render
 *
 * Toda a lógica específica fica nos módulos respectivos.
 */

import { validateFile } from './security.js';
import { parseBRNum, parseSheet } from './parser.js';
import { enrichAI } from './api.js';
import { buildFilters, applyFilters } from './filters.js';
import { rebuildCharts } from './charts.js';
import { render, renderAIChips, renderTable } from './render.js';
import { runRebalance } from './rebalance.js';
import { toggleTheme, switchTab, showL, stepL, hideL } from './ui.js';

// ── Estado Global ──────────────────────────────────────────────────────────
let ALL = [];   // todos os FIIs da planilha
let FIL = [];   // subset filtrado
let CHARTS = {};   // instâncias Chart.js

// ── Funções que precisam do estado global ─────────────────────────────────
function _rebuildCharts() { rebuildCharts(FIL, CHARTS); }
function _render() { render(FIL, CHARTS, _rebuildCharts); }
function _applyFilters() { FIL = applyFilters(ALL); _render(); }
function _toggleTheme() { toggleTheme(_rebuildCharts); }
function _runRebalance() { runRebalance(ALL); }

// ── Upload e processamento de planilha ─────────────────────────────────────
async function processFile(file) {
  const err = validateFile(file);
  if (err) { alert('❌ Erro de segurança: ' + err); return; }

  showL('Aguarde...');

  // Duplo rAF garante que o browser renderize o loader antes de bloquear o thread
  requestAnimationFrame(() => requestAnimationFrame(async () => {
    stepL(0, 'Lendo arquivo Excel...');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const sn = wb.SheetNames.find(n => n === 'MetasFIIs') || wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });

        setTimeout(async () => {
          stepL(1, 'Mapeando colunas da planilha...');
          const parsed = parseSheet(rows);
          if (!parsed) { hideL(); alert('Planilha vazia ou formato inválido.'); return; }

          ALL = parsed;
          FIL = [...ALL];

          stepL(2, 'IA pesquisando na internet — buscando dados reais por fundo...');

          await enrichAI(
            ALL,
            (pct, msg) => {
              const lBar = document.getElementById('lBar');
              const lMsg = document.getElementById('lMsg');
              if (lBar) lBar.style.width = Math.min(pct, 100) + '%';
              if (lMsg) lMsg.textContent = msg;
            },
            (cnt, total) => {
              const aiCnt = document.getElementById('aiCnt');
              if (aiCnt) aiCnt.textContent = `${cnt}/${total}`;
              // Atualiza chips durante o enriquecimento
              renderAIChips(ALL);
            }
          );

          stepL(3, 'Calculando métricas...');
          setTimeout(() => {
            stepL(4, 'Renderizando dashboard...');
            FIL = [...ALL];
            buildFilters(ALL);
            _render();
            hideL();
          }, 60);
        }, 60);

      } catch (e) {
        hideL();
        alert('Erro ao ler planilha: ' + e.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }));
}

// ── Event Listeners ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Tema
  document.getElementById('thBtn')?.addEventListener('click', _toggleTheme);

  // Filtros
  document.getElementById('applyFiltersBtn')?.addEventListener('click', _applyFilters);

  // Abas
  document.getElementById('tab-overview')?.addEventListener('click', () => switchTab('overview'));
  document.getElementById('tab-rebalance')?.addEventListener('click', () => switchTab('rebalance'));

  // Rebalanceamento
  document.getElementById('rbRunBtn')?.addEventListener('click', _runRebalance);

  // Upload de planilha
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('click', function () { this.value = ''; });
    fileInput.addEventListener('change', async function (e) {
      const f = e.target.files[0];
      if (!f) return;
      this.value = '';
      await processFile(f);
    });
  }
});