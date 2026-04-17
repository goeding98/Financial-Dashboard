import { Router, Request, Response } from 'express';
import { siigoService } from '../services/siigo';
import { sheetsService } from '../services/sheets';
import { flushAllCaches } from '../services/cache';
import { PnL, CashFlow, KPISummary, RevenueTrend, NoEbitdaItem } from '../types/financial';

const router = Router();
const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function makePeriod(year: number, month: number) {
  return { year, month, label: `${MONTHS_ES[month - 1]} ${year}` };
}

// ── Refresh (invalida todos los caches) ──────────────────────────────────────
router.post('/refresh', (_req, res: Response) => {
  flushAllCaches();
  res.json({ ok: true, flushedAt: new Date().toISOString() });
});

// ── Status ───────────────────────────────────────────────────────────────────
router.get('/status', async (_req, res: Response) => {
  const siigo = await siigoService.testConnection();
  let sheetsOk = false, sheetsMsg = 'Sin configurar';
  try {
    const sedes = await sheetsService.getSedes();
    sheetsOk = sedes.length > 0;
    sheetsMsg = sheetsOk ? `Conectado — sedes: ${sedes.join(', ')}` : 'Sin datos';
  } catch (e: any) { sheetsMsg = e.message; }

  res.json({ status: 'ok', siigo, sheets: { ok: sheetsOk, message: sheetsMsg }, timestamp: new Date().toISOString() });
});

// ── Debug: ver clasificación real de ítems de factura ────────────────────────
router.get('/debug/types', async (req: Request, res: Response) => {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const sede  = req.query.sede as string | undefined;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay   = new Date(year, month, 0).getDate();
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const invoices: any[] = await (siigoService as any).getInvoices(startDate, endDate);

    const SELLER_SEDE_MAP: Record<number, string> = { 948: 'Colseguros', 956: 'Ciudad Jardin' };
    const PRORATE_SELLER_ID = 437;

    const items: { seller: number; sellerSede: string; code: string; description: string; quantity: number; total: number; classified: string }[] = [];

    for (const inv of invoices) {
      let includeSede = !sede;
      if (sede) {
        if (inv.seller === PRORATE_SELLER_ID) includeSede = true;
        else if (SELLER_SEDE_MAP[inv.seller] === sede) includeSede = true;
      }
      if (!includeSede) continue;

      for (const item of inv.items || []) {
        const desc = (item.description || '').toUpperCase().trim();
        let classified = 'Otros';
        if (desc.includes('CONSULTA'))   classified = 'Consultas';
        else if (desc.includes('HOSPIT'))   classified = 'Hospitalización';
        else if (desc.includes('CIRUG'))    classified = 'Cirugías';
        else if (desc.includes('VACUN'))    classified = 'Vacunación';
        else if (desc.includes('LABORATOR') || desc.includes('EXAMEN')) classified = 'Laboratorio';
        else if (desc.includes('URGENCIA') || desc.includes('EMERGENCIA')) classified = 'Urgencias';
        else if (desc.includes('IMAGEN') || desc.includes('ECOGRAF') || desc.includes('RADIO')) classified = 'Imágenes';
        else if (desc.includes('GROOMING') || desc.includes('BAÑO') || desc.includes('ESTETICA')) classified = 'Estética';
        else if (desc.includes('MEDICAMENTO') || desc.includes('FARMACIA') || desc.includes('PETSHOP')) classified = 'Farmacia/Petshop';

        items.push({
          seller: inv.seller,
          sellerSede: SELLER_SEDE_MAP[inv.seller] || (inv.seller === PRORATE_SELLER_ID ? 'empresa(437)' : `seller_${inv.seller}`),
          code: item.code || '',
          description: item.description || '',
          quantity: item.quantity || 1,
          total: item.total || 0,
          classified,
        });
      }
    }

    // Summary by classified type
    const summary: Record<string, { count: number; lineItems: number }> = {};
    for (const it of items) {
      if (!summary[it.classified]) summary[it.classified] = { count: 0, lineItems: 0 };
      summary[it.classified].count     += it.quantity;
      summary[it.classified].lineItems += 1;
    }

    res.json({ period: `${month}/${year}`, sede: sede || 'Todas', summary, items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sedes y Sellers ──────────────────────────────────────────────────────────
router.get('/sedes', async (_req, res: Response) => {
  const sedes = await sheetsService.getSedes().catch(() => ['Colseguros', 'Ciudad Jardin']);
  res.json(sedes);
});

router.get('/sellers', async (_req, res: Response) => {
  const sellers = await siigoService.getSellers().catch(() => []);
  res.json(sellers);
});

// ── KPIs ─────────────────────────────────────────────────────────────────────
router.get('/kpis', async (req: Request, res: Response) => {
  try {
    const year   = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month  = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const sede   = req.query.sede as string | undefined;
    const toDay  = req.query.toDay ? parseInt(req.query.toDay as string) : undefined;

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;

    const [revenue, revenuePrev, expenses, expensesPrev] = await Promise.all([
      siigoService.getRevenueByMonth(year, month, sede, toDay).catch(() => getMockRevenue(year, month)),
      siigoService.getRevenueByMonth(prevYear, prevMonth, sede).catch(() => getMockRevenue(prevYear, prevMonth)),
      sheetsService.getExpenses(year, month, sede),
      sheetsService.getExpenses(prevYear, prevMonth, sede),
    ]);

    const pnl     = buildPnL(year, month, revenue, expenses);
    const pnlPrev = buildPnL(prevYear, prevMonth, revenuePrev, expensesPrev);

    const summary: KPISummary = {
      period: makePeriod(year, month),
      revenue: pnl.revenue,           revenuePrev: pnlPrev.revenue,
      grossProfit: pnl.grossProfit,   grossProfitPrev: pnlPrev.grossProfit,
      grossMargin: pnl.grossMargin,
      ebitda: pnl.ebitda,             ebitdaPrev: pnlPrev.ebitda,
      ebitdaMargin: pnl.ebitdaMargin,
      ebit: pnl.ebit,
      netIncome: pnl.netIncome,       netMargin: pnl.netMargin,
    };
    res.json(summary);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── P&G (uno o varios meses) ─────────────────────────────────────────────────
// GET /api/pnl?year=2026&month=2&sede=Colseguros
// GET /api/pnl/multi?months=2026-2,2026-3&sede=Colseguros
router.get('/pnl', async (req: Request, res: Response) => {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const sede  = req.query.sede as string | undefined;
    const toDay = req.query.toDay ? parseInt(req.query.toDay as string) : undefined;

    const [revenue, expenses] = await Promise.all([
      siigoService.getRevenueByMonth(year, month, sede, toDay).catch(() => getMockRevenue(year, month)),
      sheetsService.getExpenses(year, month, sede),
    ]);

    res.json(buildPnL(year, month, revenue, expenses));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/pnl/multi', async (req: Request, res: Response) => {
  try {
    const monthsParam = (req.query.months as string) || '';
    const sede = req.query.sede as string | undefined;
    const periods = monthsParam.split(',').map(s => {
      const [y, m] = s.trim().split('-');
      return { year: parseInt(y), month: parseInt(m) };
    }).filter(p => !isNaN(p.year) && !isNaN(p.month));

    if (!periods.length) { res.status(400).json({ error: 'Formato: months=2026-2,2026-3' }); return; }

    const results = await Promise.all(
      periods.map(async ({ year, month }) => {
        const [revenue, expenses] = await Promise.all([
          siigoService.getRevenueByMonth(year, month, sede).catch(() => getMockRevenue(year, month)),
          sheetsService.getExpenses(year, month, sede),
        ]);
        return buildPnL(year, month, revenue, expenses);
      })
    );
    res.json(results);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Cash Flow ─────────────────────────────────────────────────────────────────
router.get('/cashflow', async (req: Request, res: Response) => {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const sede  = req.query.sede as string | undefined;

    const [revenue, expenses, cfItems] = await Promise.all([
      siigoService.getRevenueByMonth(year, month, sede).catch(() => getMockRevenue(year, month)),
      sheetsService.getExpenses(year, month, sede),
      sheetsService.getCashFlowItems(year, month, sede),
    ]);

    const pnl    = buildPnL(year, month, revenue, expenses);
    const capex  = cfItems.filter(i => i.category === 'investing'   && i.type === 'subtract').reduce((s, i) => s + i.amount, 0);
    const wc     = cfItems.filter(i => i.category === 'operating'   && i.type === 'subtract').reduce((s, i) => s + i.amount, 0);
    const extOrd = cfItems.filter(i => i.category === 'financing').reduce((s, i) => s + (i.type === 'subtract' ? -i.amount : i.amount), 0);
    const other  = cfItems.filter(i => i.category === 'operating'   && i.type === 'add').reduce((s, i) => s + i.amount, 0);

    const noEbitdaItems: NoEbitdaItem[] = expenses
      .filter(e => e.category === 'interest' || e.category === 'tax')
      .map(e => ({ label: e.label, sublabel: e.sublabel, amount: e.amount, category: e.category as 'interest' | 'tax' }));
    const noEbitdaTotal = noEbitdaItems.reduce((s, i) => s + i.amount, 0);
    const freeCashFlow  = pnl.ebitda - capex - wc + extOrd + other;

    const cf: CashFlow = {
      period: makePeriod(year, month),
      ebitda: pnl.ebitda, capex, workingCapitalChange: wc,
      extraordinaryPayments: extOrd, otherAdjustments: other,
      freeCashFlow,
      items: cfItems,
      noEbitdaItems,
      noEbitdaTotal,
      cajaFinal: freeCashFlow - noEbitdaTotal,
    };
    res.json(cf);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Tendencia ─────────────────────────────────────────────────────────────────
router.get('/trend', async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 3;
    const sede   = req.query.sede as string | undefined;
    const trend  = await siigoService.getRevenueTrend(months, sede);

    const enriched: RevenueTrend[] = await Promise.all(
      trend.map(async (t) => {
        const expenses = await sheetsService.getExpenses(t.year, t.month, sede);
        const pnl = buildPnL(t.year, t.month, t.revenue, expenses);
        return { period: t.period, revenue: t.revenue, grossProfit: pnl.grossProfit, ebitda: pnl.ebitda };
      })
    );
    res.json(enriched);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Ingresos por tipo de servicio ─────────────────────────────────────────────
router.get('/revenue-by-type', async (req: Request, res: Response) => {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const sede  = req.query.sede as string | undefined;
    const toDay = req.query.toDay ? parseInt(req.query.toDay as string) : undefined;
    const data  = await siigoService.getRevenueByType(year, month, sede, toDay);
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/revenue-by-type/trend?months=2026-2,2026-3&sede=Colseguros&toDay=15
router.get('/revenue-by-type/trend', async (req: Request, res: Response) => {
  try {
    const monthsParam = req.query.months as string | undefined;
    const sede  = req.query.sede as string | undefined;
    const toDay = req.query.toDay ? parseInt(req.query.toDay as string) : undefined;

    let periods: { year: number; month: number }[];

    if (monthsParam) {
      periods = monthsParam.split(',')
        .map(s => { const [y, m] = s.trim().split('-'); return { year: parseInt(y), month: parseInt(m) }; })
        .filter(p => !isNaN(p.year) && !isNaN(p.month));
    } else {
      const now = new Date();
      periods = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        if (d >= new Date(2026, 0, 1)) periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
      }
    }

    // toDay only applies to the last (most recent) period
    const lastPeriod = periods[periods.length - 1];
    const results = await Promise.all(
      periods.map(async ({ year, month }) => {
        const isLast = year === lastPeriod?.year && month === lastPeriod?.month;
        const types = await siigoService.getRevenueByType(year, month, sede, isLast ? toDay : undefined).catch(() => []);
        return { period: `${MONTHS_ES[month - 1]} ${String(year).slice(2)}`, year, month, types };
      })
    );

    res.json(results);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildPnL(year: number, month: number, revenue: number, expenses: any[]): PnL {
  const cogs     = expenses.filter(e => e.category === 'cogs').reduce((s: number, e: any) => s + e.amount, 0);
  const opex     = expenses.filter(e => e.category === 'opex').reduce((s: number, e: any) => s + e.amount, 0);
  const da       = expenses.filter(e => e.category === 'da').reduce((s: number, e: any) => s + e.amount, 0);
  const interest = expenses.filter(e => e.category === 'interest').reduce((s: number, e: any) => s + e.amount, 0);
  const taxes    = expenses.filter(e => e.category === 'tax').reduce((s: number, e: any) => s + e.amount, 0);

  const grossProfit = revenue - cogs;
  const ebitda      = grossProfit - opex;
  const ebit        = ebitda - da;
  const netIncome   = ebit - interest - taxes;

  return {
    period: makePeriod(year, month), revenue, cogs,
    grossProfit, grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    opex, ebitda, ebitdaMargin: revenue > 0 ? (ebitda / revenue) * 100 : 0,
    da, ebit, ebitMargin: revenue > 0 ? (ebit / revenue) * 100 : 0,
    interest, taxes, netIncome, netMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
    items: expenses,
  };
}

function getMockRevenue(year: number, month: number): number {
  const base = 300000000;
  const seasonal = [0.85,0.9,1.0,1.05,1.1,1.15,1.0,0.95,1.1,1.15,1.2,1.3][month - 1];
  return Math.round(base * seasonal * (0.95 + ((year * 31 + month * 7) % 11) / 100));
}

export default router;
