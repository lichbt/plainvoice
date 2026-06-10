// Money engine. ALL monetary totals are computed here, in code (Hard Rule #2).
// Never trust amounts coming from the LLM, from imports, or from raw input —
// recompute line.amount and every total from qty/rate/taxRate.
//
// Money is handled in integer minor units internally to avoid float drift,
// then surfaced as a number rounded to the currency's precision.

import type { Invoice, InvoiceLine } from "../db/types";

/** Currencies with 0 decimal places. Default is 2. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "HUF"]);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

/** Round a value to the currency's precision using round-half-up on minor units. */
export function roundMoney(value: number, currency: string): number {
  const factor = Math.pow(10, currencyDecimals(currency));
  // +Number.EPSILON guards against e.g. 1.005 representing as 1.00499999
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** A single line's amount = qty * rate, rounded to currency precision. */
export function lineAmount(
  line: Pick<InvoiceLine, "qty" | "rate">,
  currency: string,
): number {
  const qty = Number.isFinite(line.qty) ? line.qty : 0;
  const rate = Number.isFinite(line.rate) ? line.rate : 0;
  return roundMoney(qty * rate, currency);
}

export interface Totals {
  subtotal: number;
  taxTotal: number;
  discount: number;
  total: number;
  lineAmounts: number[]; // recomputed amount per input line, in order
}

export interface ComputeInput {
  lines: Pick<InvoiceLine, "qty" | "rate" | "taxRate">[];
  /** Absolute discount amount in currency units (applied to subtotal). */
  discount?: number;
  currency: string;
}

/**
 * Compute all invoice totals from line primitives.
 *
 * - subtotal = sum of line amounts (qty*rate)
 * - tax is computed per line on its post-discount share, so a discount
 *   proportionally reduces taxable base (the defensible default).
 * - discount is clamped to [0, subtotal].
 */
export function computeTotals(input: ComputeInput): Totals {
  const { currency } = input;
  const lineAmounts = input.lines.map((l) => lineAmount(l, currency));
  const subtotal = roundMoney(
    lineAmounts.reduce((s, a) => s + a, 0),
    currency,
  );

  const rawDiscount = Number.isFinite(input.discount) ? (input.discount as number) : 0;
  const discount = roundMoney(Math.min(Math.max(rawDiscount, 0), subtotal), currency);

  // proportional taxable factor after discount
  const factor = subtotal > 0 ? (subtotal - discount) / subtotal : 0;

  let taxTotal = 0;
  input.lines.forEach((l, i) => {
    const rate = Number.isFinite(l.taxRate) ? l.taxRate : 0;
    const taxable = lineAmounts[i] * factor;
    taxTotal += taxable * (rate / 100);
  });
  taxTotal = roundMoney(taxTotal, currency);

  const total = roundMoney(subtotal - discount + taxTotal, currency);
  return { subtotal, taxTotal, discount, total, lineAmounts };
}

/** Format a number as currency for display (uses Intl). Pass a locale to match
 * the target language's grouping/decimal separators (auto-translate). */
export function formatMoney(value: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: currencyDecimals(currency),
      maximumFractionDigits: currencyDecimals(currency),
    }).format(value);
  } catch {
    return `${value.toFixed(currencyDecimals(currency))} ${currency}`;
  }
}

/** Amount still owed on an invoice given recorded payments. */
export function balanceDue(total: number, payments: { amount: number }[], currency: string): number {
  const paid = payments.reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0);
  return roundMoney(Math.max(total - paid, 0), currency);
}

/** Derive whether an invoice should display as overdue (pure, no DB). */
export function isOverdue(inv: Pick<Invoice, "status" | "dueDate" | "paidAt">, today: string): boolean {
  if (inv.paidAt || inv.status === "paid" || inv.status === "draft") return false;
  if (!inv.dueDate) return false;
  return inv.dueDate < today;
}
