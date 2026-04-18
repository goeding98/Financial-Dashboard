import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import { SiigoAuthResponse, SiigoInvoice } from '../types/financial';
import { registerCache } from './cache';

const cache = new NodeCache({ stdTTL: 28800 }); // 8 horas
registerCache(cache);

const SIIGO_USERNAME   = process.env.SIIGO_USERNAME   || '';
const SIIGO_ACCESS_KEY = process.env.SIIGO_ACCESS_KEY || '';
const SIIGO_PARTNER_ID = process.env.SIIGO_PARTNER_ID || 'FinancialDashboard';
const DATA_START       = new Date(2025, 4, 1); // Mayo 2025 — inicio de datos en el Sheet

// Mapeo vendedor → sede
// 437 = empresa (contadora) → se divide 70% Colseguros / 30% Ciudad Jardin al calcular
export const SELLER_SEDE_MAP: Record<number, string> = {
  948: 'Colseguros',    // Marilu Salazar
  956: 'Ciudad Jardin', // Marcela Moreno
};

// Vendedor 437 (empresa/contadora): se prorratean sus facturas 70/30
const PRORATE_SELLER_ID = 437;
const PRORATE_COLSEGUROS = 0.70;
const PRORATE_CIUDAD     = 0.30;


async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class SiigoService {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.SIIGO_BASE_URL || 'https://api.siigo.com',
      headers: { 'Content-Type': 'application/json', 'Partner-Id': SIIGO_PARTNER_ID },
      timeout: 15000,
    });
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }
    const response = await this.client.post<SiigoAuthResponse>('/auth', {
      username: SIIGO_USERNAME,
      access_key: SIIGO_ACCESS_KEY,
    });
    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + (response.data.expires_in || 3600) * 1000 - 60000);
    console.log('[Siigo] Token renovado');
    return this.accessToken;
  }

  private async get<T>(path: string, params: Record<string, any> = {}, retries = 3): Promise<T> {
    const token = await this.authenticate();
    try {
      const res = await this.client.get<T>(path, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 429 && retries > 0) {
        const wait = (parseInt(err.response.headers['retry-after'] || '3') + 1) * 1000;
        console.log(`[Siigo] Rate limit, esperando ${wait / 1000}s...`);
        await sleep(wait);
        return this.get<T>(path, params, retries - 1);
      }
      throw err;
    }
  }

  async getInvoices(startDate: string, endDate: string, sellerIds?: number[]): Promise<SiigoInvoice[]> {
    const cacheKey = `invoices_${startDate}_${endDate}_${sellerIds?.join(',') || 'all'}`;
    const cached = cache.get<SiigoInvoice[]>(cacheKey);
    if (cached) return cached;

    const allInvoices: SiigoInvoice[] = [];
    let page = 1;

    while (true) {
      const data: any = await this.get('/v1/invoices', {
        created_start: startDate,
        created_end: endDate,
        page,
        page_size: 100,
      });

      const results: SiigoInvoice[] = (data.results || []).filter((inv: any) => {
        if (!sellerIds || sellerIds.length === 0) return true;
        return sellerIds.includes(inv.seller);
      });

      allInvoices.push(...results);

      const total = data.pagination?.total_results || 0;
      const fetched = page * 100;
      console.log(`[Siigo] Facturas ${Math.min(fetched, total)}/${total} (pag ${page})`);

      if (fetched >= total || data.results?.length === 0 || page >= 50) break;
      page++;
      await sleep(300);
    }

    cache.set(cacheKey, allInvoices);
    return allInvoices;
  }

  async getRevenueByMonth(year: number, month: number, sede?: string, toDay?: number): Promise<number> {
    const cacheKey = `revenue_${year}_${month}_${sede || 'all'}_${toDay || 'full'}`;
    const cached = cache.get<number>(cacheKey);
    if (cached !== undefined) return cached;

    const startDate   = `${year}-${String(month).padStart(2, '0')}-01`;
    const fullEndDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    // Siempre traer el mes completo (Siigo no filtra confiablemente por día con created_end)
    const allInvoices = await this.getInvoices(startDate, fullEndDate);

    // Filtrar por día en memoria usando el campo date de la factura
    const invoices = toDay
      ? allInvoices.filter((inv: any) => {
          const d = inv.date ? new Date(inv.date).getDate() : 1;
          return d <= toDay;
        })
      : allInvoices;

    let revenue = 0;
    for (const inv of invoices as any[]) {
      const amount = inv.subtotal ?? inv.total ?? 0;
      if (!sede) {
        revenue += amount;
      } else if (inv.seller === PRORATE_SELLER_ID) {
        revenue += amount * (sede === 'Colseguros' ? PRORATE_COLSEGUROS : PRORATE_CIUDAD);
      } else {
        const sellerSede = SELLER_SEDE_MAP[inv.seller] ?? 'Ciudad Jardin';
        if (sellerSede === sede) revenue += amount;
      }
    }

    cache.set(cacheKey, revenue);
    console.log(`[Siigo] Revenue ${month}/${year}${sede ? ' (' + sede + ')' : ''}${toDay ? ` (hasta día ${toDay})` : ''}: $${Math.round(revenue).toLocaleString('es-CO')}`);
    return revenue;
  }

  async getProductReferenceMap(): Promise<Record<string, string>> {
    const cacheKey = 'product_reference_map';
    const cached = cache.get<Record<string, string>>(cacheKey);
    if (cached) return cached;

    const map: Record<string, string> = {};
    let page = 1;

    while (true) {
      const data: any = await this.get('/v1/products', { page, page_size: 100 });
      const results = data.results || [];

      for (const product of results) {
        if (product.code && product.reference) {
          map[String(product.code)] = product.reference.trim();
        }
      }

      const total = data.pagination?.total_results || 0;
      console.log(`[Siigo] Productos ${Math.min(page * 100, total)}/${total} (pag ${page})`);
      if (page * 100 >= total || results.length === 0 || page >= 30) break;
      page++;
      await sleep(300);
    }

    cache.set(cacheKey, map, 86400); // caché 24h
    console.log(`[Siigo] Mapa referencias: ${Object.keys(map).length} productos`);
    return map;
  }

  async getRevenueByType(year: number, month: number, sede?: string, toDay?: number): Promise<{ type: string; revenue: number; count: number }[]> {
    const cacheKey = `rev_type_${year}_${month}_${sede || 'all'}_${toDay || 'full'}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const startDate   = `${year}-${String(month).padStart(2, '0')}-01`;
    const fullEndDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const [allInvoices, refMap] = await Promise.all([
      this.getInvoices(startDate, fullEndDate),
      this.getProductReferenceMap(),
    ]);

    // Filtrar por día en memoria
    const invoices = toDay
      ? allInvoices.filter((inv: any) => {
          const d = inv.date ? new Date(inv.date).getDate() : 1;
          return d <= toDay;
        })
      : allInvoices;

    const byType: Record<string, { revenue: number; count: number }> = {};

    for (const inv of invoices as any[]) {
      let factor = 1;
      if (sede) {
        if (inv.seller === PRORATE_SELLER_ID) {
          factor = sede === 'Colseguros' ? PRORATE_COLSEGUROS : PRORATE_CIUDAD;
        } else {
          const sellerSede = SELLER_SEDE_MAP[inv.seller] ?? 'Ciudad Jardin';
          if (sellerSede !== sede) continue;
        }
      }

      for (const item of inv.items || []) {
        // Clasificar por Referencia de Fábrica primero, descripción como fallback
        const reference = refMap[String(item.code)] || '';
        const key = reference
          ? normalizeReference(reference)
          : normalizeServiceType((item.description || '').toUpperCase().trim());

        if (!byType[key]) byType[key] = { revenue: 0, count: 0 };
        byType[key].revenue += (item.total || 0) * factor;
        byType[key].count   += (item.quantity || 1) * factor;
      }
    }

    const result = Object.entries(byType)
      .map(([type, { revenue, count }]) => ({ type, revenue: Math.round(revenue), count: Math.round(count) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    cache.set(cacheKey, result);
    return result;
  }

  async getRevenueTrend(months = 6, sede?: string, toDay?: number): Promise<{ period: string; revenue: number; year: number; month: number }[]> {
    const results = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const label = date.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });

      if (date < DATA_START) {
        results.push({ period: label, revenue: 0, year, month });
        continue;
      }

      try {
        const revenue = await this.getRevenueByMonth(year, month, sede, toDay);
        results.push({ period: label, revenue, year, month });
      } catch {
        results.push({ period: label, revenue: 0, year, month });
      }
      await sleep(500);
    }
    return results;
  }

  async getSellers(): Promise<{ id: number; name: string; sede?: string }[]> {
    try {
      const data: any = await this.get('/v1/users', { page_size: 25 });
      return (data.results || []).map((u: any) => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`.trim(),
        sede: SELLER_SEDE_MAP[u.id],
      }));
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.authenticate();
      return { ok: true, message: `Conectado como ${SIIGO_USERNAME}` };
    } catch (err: any) {
      return { ok: false, message: err?.response?.data?.Errors?.[0]?.Message || err.message };
    }
  }
}

// Normaliza el valor de "Referencia de Fábrica" de Siigo.
// Solo unifica plurales/variaciones exactas del mismo concepto; todo lo demás pasa tal cual.
function normalizeReference(ref: string): string {
  const r = ref.toLowerCase().trim();
  if (r === 'consulta'    || r === 'consultas')                        return 'Consultas';
  if (r === 'urgencia'    || r === 'urgencias')                        return 'Urgencias';
  if (r.includes('cirug'))                                             return 'Cirugías';
  if (r.includes('vacun'))                                             return 'Vacunación';
  if (r === 'laboratorio' || r === 'laboratorios')                     return 'Laboratorio';
  if (r.includes('ecograf'))                                           return 'Ecografía';
  if (r.includes('radiograf'))                                         return 'Radiografía';
  if (r.includes('hospit') || r.includes('internac'))                  return 'Hospitalización';
  if (r.includes('grooming') || r.includes('estétic') || r.includes('estetica') || r.includes('baño')) return 'Estética / Grooming';
  if (r.includes('petshop') || r.includes('farmacia') || r.includes('medicament')) return 'Farmacia / Petshop';
  if (r.includes('control'))                                           return 'Controles';
  // Valor real de la referencia — convertir a Title Case
  return ref.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeServiceType(desc: string): string {
  if (desc.includes('CONSULTA')) return 'Consultas';
  if (desc.includes('HOSPIT')) return 'Hospitalización';
  if (desc.includes('CIRUG')) return 'Cirugías';
  if (desc.includes('VACUN')) return 'Vacunación';
  if (desc.includes('LABORATOR') || desc.includes('EXAMEN')) return 'Laboratorio';
  if (desc.includes('URGENCIA') || desc.includes('EMERGENCIA')) return 'Urgencias';
  if (desc.includes('ECOGRAF')) return 'Ecografía';
  if (desc.includes('RADIOGRAF')) return 'Radiografía';
  if (desc.includes('GROOMING') || desc.includes('BAÑO') || desc.includes('ESTETICA')) return 'Estética / Grooming';
  if (desc.includes('MEDICAMENTO') || desc.includes('FARMACIA') || desc.includes('PETSHOP')) return 'Farmacia / Petshop';
  if (desc.includes('INTERNACION')) return 'Internación';
  if (desc.includes('CONTROL')) return 'Controles';
  if (desc.includes('PROCEDIMIENTO')) return 'Procedimientos';
  return desc.length > 30 ? desc.substring(0, 30) + '...' : desc;
}

export const siigoService = new SiigoService();
