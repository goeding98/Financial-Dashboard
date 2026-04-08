import axios from 'axios';
import NodeCache from 'node-cache';
import { PnLItem, CashFlowItem } from '../types/financial';
import { registerCache } from './cache';

const cache = new NodeCache({ stdTTL: 1800 });
registerCache(cache);

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1NN6D6hrqXwAlbbACVkA2U11s7LIvu3urZMCT4dZcvt0';
const SHEET_NAME = 'egresos';

// Columnas (0-indexed):
// A=0:Año  B=1:Mes  C=2:Dia  D=3:FECHA  E=4:SEDE  F=5:Nombre  G=6:Id
// H=7:Tipo de Egreso  I=8:Valor Pagado  J-N: formas de pago
// O=14:Factura  P=15:Clasificacion Op.  Q=16:Clasificacion Fin.

function parseCSV(line: string): string[] {
  const f: string[] = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { f.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  f.push(cur.trim());
  return f;
}

function cleanNumber(raw: string): number {
  if (!raw) return 0;
  let s = raw.replace(/["' ]/g, '').trim();
  if (!s || s === '0') return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/\./g, '');
  return parseFloat(s) || 0;
}

// Mapea la columna Q (Clasificacion Fin.) a categoría interna del P&G
function classifyRow(tipoEgreso: string, clasificacionFin: string): Pick<PnLItem, 'category' | 'isEBITDA' | 'isEBIT'> | null {
  const fin = clasificacionFin.toLowerCase().trim();
  const tipo = tipoEgreso.toLowerCase().trim();

  // Ignorar filas sin clasificación válida
  if (!fin || fin === '0' || fin === 'pagos vendedor') return null;

  // CAPEX → no impacta P&G (va al flujo de caja)
  if (fin === 'capex') return null;

  // No EBITDA → puede ser D&A, intereses, impuestos
  if (fin === 'no ebitda') {
    if (tipo.includes('deprecia') || tipo.includes('amortiz')) {
      return { category: 'da', isEBITDA: false, isEBIT: true };
    }
    if (tipo.includes('interes') || tipo.includes('gasto financiero') || tipo.includes('gmf') || tipo.includes('4x1000')) {
      return { category: 'interest', isEBITDA: false, isEBIT: false };
    }
    if (tipo.includes('impuesto') || tipo.includes('retención') || tipo.includes('retencion')) {
      return { category: 'tax', isEBITDA: false, isEBIT: false };
    }
    // Default No EBITDA: interest
    return { category: 'interest', isEBITDA: false, isEBIT: false };
  }

  // Costo → COGS
  if (fin === 'costo') {
    return { category: 'cogs', isEBITDA: true, isEBIT: true };
  }

  // Gasto → OPEX
  if (fin === 'gasto' || fin === 'gasto') {
    return { category: 'opex', isEBITDA: true, isEBIT: true };
  }

  return null;
}

async function fetchSheetCSV(): Promise<string[][]> {
  // Usar /export en vez de /gviz — gviz tiene límite de ~16 filas cuando el Sheet es grande
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const response = await axios.get<string>(url, { responseType: 'text', timeout: 15000 });
  const lines = response.data.split('\n').filter(l => l.trim());
  return lines.slice(1).map(parseCSV);
}

export class SheetsService {
  async getExpenses(year: number, month: number, sede?: string): Promise<PnLItem[]> {
    const cacheKey = `expenses_${year}_${month}_${sede || 'all'}`;
    const cached = cache.get<PnLItem[]>(cacheKey);
    if (cached) return cached;

    try {
      const rows = await fetchSheetCSV();

      const items: PnLItem[] = rows
        .filter(row => {
          if (row.length < 9) return false;
          if (parseInt(row[0]) !== year || parseInt(row[1]) !== month) return false;
          if (sede && row[4]?.toLowerCase().trim() !== sede.toLowerCase().trim()) return false;
          return true;
        })
        .map((row, idx) => {
          const tipo = row[7] || '';
          const clasificacionOp = row[15] || tipo; // Columna P (label legible)
          const clasificacionFin = row[16] || '';
          const amount = cleanNumber(row[8]);

          const classification = classifyRow(tipo, clasificacionFin);
          if (!classification || amount <= 0) return null;

          const nombre = (row[5] || '').trim().toUpperCase(); // Columna F: Nombre

          return {
            id: `sheet_${year}_${month}_${idx}`,
            label: clasificacionOp || tipo,  // Col P → nivel 2
            sublabel: nombre,                // Col F → nivel 3
            amount,
            ...classification,
          } as PnLItem;
        })
        .filter((item): item is PnLItem => item !== null);

      cache.set(cacheKey, items);
      console.log(`[Sheets] ${items.length} egresos cargados para ${month}/${year}${sede ? ` (${sede})` : ''}`);
      return items;
    } catch (err: any) {
      console.warn('[Sheets] Error leyendo Sheet, usando mock:', err.message);
      return getMockExpenses(year, month);
    }
  }

  async getCashFlowItems(year: number, month: number, sede?: string): Promise<CashFlowItem[]> {
    // CAPEX viene del mismo sheet, filas con Clasificacion Fin. = "CAPEX"
    try {
      const rows = await fetchSheetCSV();
      const capexRows = rows.filter(row =>
        parseInt(row[0]) === year &&
        parseInt(row[1]) === month &&
        row[16]?.toLowerCase().trim() === 'capex' &&
        (!sede || row[4]?.toLowerCase().trim() === sede.toLowerCase().trim())
      );

      const capexItems: CashFlowItem[] = capexRows.map(row => ({
        label: row[15] || row[7] || 'CAPEX',
        sublabel: (row[5] || '').trim().toUpperCase(),
        amount: cleanNumber(row[8]),
        type: 'subtract' as const,
        category: 'investing' as const,
      })).filter(i => i.amount > 0);

      return capexItems.length > 0 ? capexItems : [];
    } catch {
      return [];
    }
  }

  async getSedes(): Promise<string[]> {
    try {
      const rows = await fetchSheetCSV();
      const sedes = [...new Set(rows.map(r => r[4]?.trim()).filter(Boolean))];
      return sedes.sort();
    } catch {
      return ['Colseguros', 'Ciudad Jardin'];
    }
  }

  async getTiposEgreso(): Promise<{ tipo: string; total: number }[]> {
    try {
      const rows = await fetchSheetCSV();
      const byTipo: Record<string, number> = {};
      for (const row of rows) {
        const tipo = row[7] || 'Otros';
        const amount = cleanNumber(row[8]);
        byTipo[tipo] = (byTipo[tipo] || 0) + amount;
      }
      return Object.entries(byTipo)
        .map(([tipo, total]) => ({ tipo, total }))
        .sort((a, b) => b.total - a.total);
    } catch {
      return [];
    }
  }
}

function getMockExpenses(year: number, month: number): PnLItem[] {
  const base = 80000000 + (year * 12 + month) * 1234567 % 20000000;
  return [
    { id: 'm1', label: 'Insumos Hospitalarios', sublabel: 'BIOMET',           amount: base * 0.20, category: 'cogs', isEBITDA: true, isEBIT: true },
    { id: 'm2', label: 'Insumos Hospitalarios', sublabel: 'DISTRIBUIDORA',     amount: base * 0.10, category: 'cogs', isEBITDA: true, isEBIT: true },
    { id: 'm3', label: 'Laboratorio Externo',   sublabel: 'LAB EXTERNO',       amount: base * 0.10, category: 'cogs', isEBITDA: true, isEBIT: true },
    { id: 'm4', label: 'Nómina',                sublabel: 'NOMINA',            amount: base * 0.15, category: 'opex', isEBITDA: true, isEBIT: true },
    { id: 'm5', label: 'Turno',                 sublabel: 'TURNO NOCTURNO',    amount: base * 0.12, category: 'opex', isEBITDA: true, isEBIT: true },
    { id: 'm6', label: 'Publicidad',            sublabel: 'DLO GOOGLE',        amount: base * 0.05, category: 'opex', isEBITDA: true, isEBIT: true },
    { id: 'm7', label: 'Gasto Financiero',      sublabel: 'GASTOS BANCARIOS',  amount: base * 0.02, category: 'interest', isEBITDA: false, isEBIT: false },
  ];
}

export const sheetsService = new SheetsService();
