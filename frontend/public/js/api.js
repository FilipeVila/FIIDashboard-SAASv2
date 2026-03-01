/**
 * api.js — Comunicação com o Backend (Anthropic AI via proxy Python)
 *
 * Segurança:
 * - NUNCA envia a API key — ela fica no servidor Python
 * - Rate limit verificado antes de cada chamada (Camada 3)
 * - Resposta da IA sanitizada antes de qualquer uso (Camada 2)
 */
import { checkRateLimit, sanitizeAIHtml, safeNum, esc } from './security.js';
import { parseBRNum } from './parser.js';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const _safeF = (v) => {
    const f = safeNum(v, parseBRNum);
    return f > 0 ? f : null;
};

/**
 * Enriquece os dados de cada FII via Claude AI (web search).
 * Faz duas passagens: busca na internet + consolidação em JSON.
 *
 * @param {object[]} ALL - Array de FIIs a enriquecer (mutado in-place)
 * @param {function} onProgress - Callback (pct, msg) para atualizar UI
 * @param {function} onCountUpdate - Callback (cnt, total) para contador
 */
export async function enrichAI(ALL, onProgress, onCountUpdate) {
    const tks = ALL.map(d => d.tk);
    let cnt = 0;

    for (let i = 0; i < tks.length; i++) {
        const tk = tks[i];
        const pct = Math.round(12 + (i / tks.length) * 68);
        onProgress?.(pct, `🔍 Pesquisando ${tk} na internet... (${i + 1}/${tks.length})`);

        try {
            // ── Camada 3: Rate limit de sessão ───────────────────────────────
            checkRateLimit();

            // ── Passo 1: Busca na internet com web_search ────────────────────
            const searchResp = await fetch('/api/ai/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 800,
                    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
                    messages: [{
                        role: 'user',
                        content: `Pesquise no Funds Explorer ou Status Invest os dados atuais do FII ${tk}: preço atual, valor patrimonial por cota (VP/Cota), P/VP, DY do último mês e último rendimento distribuído por cota. Traga os números exatos encontrados.`,
                    }],
                }),
            });

            if (!searchResp.ok) {
                console.warn(`enrichAI: ${tk} — HTTP ${searchResp.status}`);
                continue;
            }
            const searchData = await searchResp.json();

            // ── Camada 2: Sanitiza resposta da IA antes de usar ───────────────
            const rawText = sanitizeAIHtml(
                (searchData.content || [])
                    .map(b => b.type === 'text' ? b.text : b.type === 'tool_result' ? JSON.stringify(b.content) : '')
                    .join('\n')
            );

            // ── Passo 2: Consolida em JSON limpo ─────────────────────────────
            checkRateLimit();
            const consolidateResp = await fetch('/api/ai/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 200,
                    messages: [{
                        role: 'user',
                        content: `Com base nos dados a seguir sobre o FII ${tk}, preencha este JSON com os valores numéricos encontrados. Responda APENAS o JSON, sem texto, sem markdown.\n\nDados encontrados:\n${rawText.slice(0, 2000)}\n\nJSON a preencher (substitua os zeros pelos valores reais):\n{"segmento":"","categoria":"","preco":0,"val_patrimonial_p_cota":0,"pvp":0,"dy_mensal":0,"rend_cota":0,"tendencia":""}\n\nRegras:\n- segmento: Logística / Shoppings / Lajes Corporativas / Recebíveis Imobiliários / Crédito Imobiliário / Híbrido / Fiagro / Fundo de Fundos / Residencial / Hotel\n- categoria: Papel / Tijolo / FOF / Fiagro\n- preco: preço atual em R$ (ex: 9.85)\n- val_patrimonial_p_cota: Valor Patrimonial por Cota em R$ (ex: 10.23)\n- pvp: P/VP = preco/val_patrimonial_p_cota (ex: 0.963)\n- dy_mensal: dividend yield mensal em decimal (ex: 1.05% → 0.0105)\n- rend_cota: último dividendo em R$/cota (ex: 0.10)\n- tendencia: alta / baixa / lateral`,
                    }],
                }),
            });

            if (!consolidateResp.ok) continue;
            const consolidateData = await consolidateResp.json();
            const consolidateText = (consolidateData.content || [])
                .filter(b => b.type === 'text').map(b => b.text || '').join('');

            const cleaned = consolidateText.replace(/```json|```/gi, '').trim();
            const match = cleaned.match(/\{[^{}]+\}/);
            if (!match) continue;

            let ai;
            try { ai = JSON.parse(match[0]); } catch { continue; }

            const d = ALL.find(x => x.tk === tk);
            if (d && ai) {
                if (ai.segmento) d.aSeg = esc(String(ai.segmento).slice(0, 80));
                if (ai.categoria) d.aCat = esc(String(ai.categoria).slice(0, 40));
                if (_safeF(ai.preco)) d.aVl = _safeF(ai.preco);
                if (_safeF(ai.pvp)) d.aPv = _safeF(ai.pvp);
                if (_safeF(ai.dy_mensal)) d.aDy = _safeF(ai.dy_mensal);
                if (_safeF(ai.rend_cota)) d.aRe = _safeF(ai.rend_cota);

                const aiVpc = _safeF(ai.val_patrimonial_p_cota) || _safeF(ai.vp_cota);
                if (aiVpc) {
                    d.aVpc = aiVpc;
                } else if (d.aVl && d.aPv && d.aPv > 0) {
                    d.aVpc = parseFloat((d.aVl / d.aPv).toFixed(4));
                }

                if (ai.tendencia) {
                    const tr = String(ai.tendencia).toLowerCase().trim();
                    d.aTr = ['alta', 'baixa', 'lateral'].includes(tr) ? tr : 'lateral';
                }

                cnt++;
                onCountUpdate?.(cnt, tks.length);
            }
        } catch (err) {
            console.warn('enrichAI error:', tk, err.message);
        }

        if (i < tks.length - 1) await sleep(200);
    }

    onCountUpdate?.(cnt, tks.length);
}
