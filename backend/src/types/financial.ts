export interface FinancialPeriod {
  year: number;
  month: number;
  label: string; // e.g. "Ene 2025"
}

export interface KPISummary {
  revenue: number;
  revenuePrev: number;
  grossProfit: number;
  grossProfitPrev: number;
  grossMargin: number;
  ebitda: number;
  ebitdaPrev: number;
  ebitdaMargin: number;
  ebit: number;
  netIncome: number;
  netMargin: number;
  period: FinancialPeriod;
}

export interface PnLItem {
  id: string;
  label: string;      // Col P: Clasificacion Op. — nivel 2 (ej: "Inversiones Estructurales")
  sublabel: string;   // Col F: Nombre            — nivel 3 (ej: "MEDICALBIO", "COMPRA CARRO")
  amount: number;
  category: 'revenue' | 'cogs' | 'opex' | 'da' | 'interest' | 'tax' | 'other';
  isEBITDA: boolean;
  isEBIT: boolean;
}

export interface PnL {
  period: FinancialPeriod;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  opex: number;
  ebitda: number;
  ebitdaMargin: number;
  da: number;
  ebit: number;
  ebitMargin: number;
  interest: number;
  taxes: number;
  netIncome: number;
  netMargin: number;
  items: PnLItem[];
}

export interface CashFlowItem {
  label: string;
  sublabel?: string;
  amount: number;
  type: 'add' | 'subtract';
  category: 'operating' | 'investing' | 'financing' | 'extraordinary';
}

export interface NoEbitdaItem {
  label: string;
  sublabel: string;
  amount: number;
  category: 'interest' | 'tax';
}

export interface CashFlow {
  period: FinancialPeriod;
  ebitda: number;
  capex: number;
  workingCapitalChange: number;
  extraordinaryPayments: number;
  otherAdjustments: number;
  freeCashFlow: number;
  items: CashFlowItem[];
  noEbitdaItems: NoEbitdaItem[];
  noEbitdaTotal: number;
  cajaFinal: number;
}

export interface RevenueTrend {
  period: string;
  revenue: number;
  grossProfit: number;
  ebitda: number;
}

export interface SiigoInvoice {
  id: number;
  document: { id: number };
  name: string;
  date: string;
  customer: { id: string; name: string };
  total: number;
  subtotal: number;
  taxes: { id: number; name: string; total: number }[];
}

export interface SiigoAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
