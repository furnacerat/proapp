import type { EstimateTaxable } from '../data/types';

export function getTaxRatePercent(rate?: number) {
  const numericRate = Number(rate ?? 0);
  return Number.isFinite(numericRate) ? Math.max(numericRate, 0) : 0;
}

export function calculateTax(subtotal: number, taxable: EstimateTaxable | undefined, taxRatePercent?: number) {
  if (!taxable || taxable === 'none') return 0;
  const safeSubtotal = Number.isFinite(Number(subtotal)) ? Math.max(Number(subtotal), 0) : 0;
  return safeSubtotal * (getTaxRatePercent(taxRatePercent) / 100);
}

export function calculateTaxedTotal(subtotal: number, taxable: EstimateTaxable | undefined, taxRatePercent?: number) {
  return subtotal + calculateTax(subtotal, taxable, taxRatePercent);
}
