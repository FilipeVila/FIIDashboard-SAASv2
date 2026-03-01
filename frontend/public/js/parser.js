/**
 * parser.js — Leitura e parse de planilha Excel (MetasFIIs)
 *
 * Responsabilidades:
 * - parseBRNum: converte strings BR para float (ex: "1.234,56" → 1234.56)
 * - parseSheet: lê a matriz da planilha e monta array de objetos FII
 */
import { esc, sanitizeTicker, safeNum } from './security.js';

/** Converte string no formato BR ou numérico para float. */
export const parseBRNum = (v) => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    let s = String(v).replace(/\s|R\$|%/ig, '');
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    const x = parseFloat(s);
    return isNaN(x) ? 0 : x;
};

const n = (v) => safeNum(v, parseBRNum);

/**
 * Parseia a matriz de dados da planilha e retorna array de FIIs.
 * @param {any[][]} rows - Matriz retornada por XLSX.utils.sheet_to_json
 * @returns {object[]} Array de objetos FII sanitizados
 */
export function parseSheet(rows) {
    // Encontra a linha de cabeçalho
    let h = -1;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i]?.some(c => c && /^ffis$|^fii$|^fiis$|^ticker$|^fundo$|^ativo$|^ativos$/i.test(String(c).trim()))) {
            h = i;
            break;
        }
    }
    if (h < 0) h = 0;
    if (!rows?.[h]) return null; // planilha inválida

    // Mapeia colunas
    const hd = rows[h].map(c => c ? String(c).trim().toLowerCase() : '');
    const C = {};
    hd.forEach((v, i) => {
        if (/segmento/.test(v)) C.seg = i;
        if (/categor/.test(v)) C.cat = i;
        if (/^ffis$|^fii$|^fiis$|^ticker$|^fundo$|^ativo$|^ativos$/.test(v)) C.tk = i;
        if (/^valor$|^preço$|^preco$/.test(v)) C.vl = i;
        if (/^cotas$/.test(v)) C.co = i;
        if (/rendimento/.test(v)) C.re = i;
        if (/^p\/vp$|^pvp$/.test(v)) C.pv = i;
        if (/^dy$/.test(v)) C.dy = i;
        if (/prec.*med|med.*prec/.test(v)) C.pm = i;
        if (/^ganhos$/.test(v)) C.ga = i;
        if (/total.*pm/.test(v)) C.tp = i;
        if (/total.*pa/.test(v)) C.ta = i;
        if (/^diferença$|^diferenca$/.test(v)) C.df = i;
        if (/vp.*cota|patrimonial.*cota|val.*patrimonial/.test(v)) C.vpc = i;
        if (/proventos/.test(v)) C.pr = i;
        if (/real/.test(v)) C.rl = i;
    });

    // Fallback de índices por posição padrão da planilha MetasFIIs
    const FB = { seg: 0, cat: 1, tk: 2, vl: 3, co: 4, re: 5, pv: 6, dy: 7, pm: 8, ga: 9, tp: 11, ta: 12, df: 13, pr: 14, rl: 15 };
    Object.keys(FB).forEach(k => { if (C[k] == null) C[k] = FB[k]; });

    const result = [];
    for (let i = h + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const tk = sanitizeTicker(row[C.tk]);
        if (!tk) continue;

        result.push({
            seg: esc(String(row[C.seg] || '').trim()) || 'N/A',
            cat: esc(String(row[C.cat] || '').trim()) || 'N/A',
            tk,
            vl: n(row[C.vl]), co: n(row[C.co]), re: n(row[C.re]),
            pv: n(row[C.pv]), dy: n(row[C.dy]), pm: n(row[C.pm]),
            ga: n(row[C.ga]), tp: n(row[C.tp]), ta: n(row[C.ta]),
            df: n(row[C.df]), pr: n(row[C.pr]), rl: n(row[C.rl]),
            vpc: n(row[C.vpc]),
            // Campos preenchidos pelo enrichAI (prefixo 'a' = "AI")
            aSeg: null, aCat: null, aPv: null, aDy: null,
            aVl: null, aVpc: null, aRe: null, aTr: null,
        });
    }
    return result;
}
