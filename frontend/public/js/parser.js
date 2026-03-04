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
    // Normaliza cabeçalhos: remove quebras de linha internas e espaços extras
    // (planilhas automatizadas usam cabeçalhos multilinhas como "PREÇO\nATUAL")
    const hd = rows[h].map(c =>
        c ? String(c).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() : ''
    );
    const C = {};
    hd.forEach((v, i) => {
        if (/segmento/.test(v)) C.seg = i;
        if (/categor/.test(v)) C.cat = i;
        if (/^ffis$|^fii$|^fiis$|^ticker$|^fundo$|^ativo$|^ativos$/.test(v)) C.tk = i;
        // "PREÇO ATUAL", "PREÇO", "VALOR" — qualquer variante
        if (/preç.*at|prec.*at|^valor$|^preço$|^preco$/.test(v)) C.vl = i;
        // "COTAS" — mas não "COTAS P/META" ou "VP/COTA"
        if (/^cotas$/.test(v)) C.co = i;
        // "REND/COTA (auto)", "RENDIMENTO", "REND COTA"
        if (/rendimento|rend.*cota|rend\/cota/.test(v) && !/total/.test(v)) C.re = i;
        // "P/VP (auto)", "P/VP", "PVP"
        if (/p\/vp|^pvp$/.test(v)) C.pv = i;
        // "DY% (calc)", "DY%", "DY"
        if (/^dy/.test(v)) C.dy = i;
        // "PREÇO MÉDIO", "PREÇO MED"
        if (/prec.*med|med.*prec|preç.*méd|preç.*med/.test(v)) C.pm = i;
        // "REND TOTAL MÊS", "GANHOS"
        if (/^ganhos$|rend.*total|ganho.*mes/.test(v)) C.ga = i;
        if (/total.*pm/.test(v)) C.tp = i;
        if (/total.*pa/.test(v)) C.ta = i;
        if (/^diferença$|^diferenca$|^dif$/.test(v)) C.df = i;
        // "VP/COTA (auto)", "VP/COTA", "VALOR PATRIMONIAL/COTA"
        if (/vp.*cota|vp\/cota|patrimonial.*cota|val.*patrimonial/.test(v)) C.vpc = i;
        if (/proventos/.test(v)) C.pr = i;
        // "DIF REAL", "REAL" — mas não "diferença"
        if (/dif.*real|^real$/.test(v)) C.rl = i;
    });

    // Fallback de índices por posição — atualizado para a nova estrutura da planilha automatizada:
    // SEGMENTOS | CATEGORIA | FII | PREÇO ATUAL | VP/COTA | P/VP | REND/COTA | DY% | COTAS | PREÇO MÉDIO | REND TOTAL MÊS | TOTAL PM | TOTAL PA | DIFERENÇA | PROVENTOS | DIF REAL
    const FB = { seg: 0, cat: 1, tk: 2, vl: 3, vpc: 4, pv: 5, re: 6, dy: 7, co: 8, pm: 9, ga: 10, tp: 11, ta: 12, df: 13, pr: 14, rl: 15 };
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
