export function formatCOP(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString('es-CO')}`;
}

export function formatCOPFull(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function delta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export const CHART_COLORS = {
  revenue:     '#1666B0',
  grossProfit: '#2A7DE1',
  ebitda:      '#1B7F4A',
  netIncome:   '#003B6F',
  cogs:        '#B91C1C',
  opex:        '#DC7A1A',
  da:          '#9CA3AF',
  interest:    '#6B7A8D',
  taxes:       '#94A3B8',
  positive:    '#1B7F4A',
  negative:    '#B91C1C',
  subtotal:    '#003B6F',
  neutral:     '#6B7A8D',
};
