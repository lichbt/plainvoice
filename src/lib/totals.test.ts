import { describe, it, expect } from "vitest";
import {
  computeTotals,
  roundMoney,
  lineAmount,
  currencyDecimals,
  balanceDue,
  isOverdue,
} from "./totals";

describe("currencyDecimals", () => {
  it("defaults to 2", () => expect(currencyDecimals("USD")).toBe(2));
  it("handles zero-decimal currencies", () => {
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("vnd")).toBe(0); // case-insensitive
  });
});

describe("roundMoney", () => {
  it("rounds half up at 2dp", () => {
    expect(roundMoney(1.005, "USD")).toBe(1.01);
    expect(roundMoney(2.675, "USD")).toBe(2.68); // classic float trap
  });
  it("rounds to 0dp for JPY", () => {
    expect(roundMoney(1234.6, "JPY")).toBe(1235);
  });
});

describe("lineAmount", () => {
  it("multiplies qty * rate", () => {
    expect(lineAmount({ qty: 3, rate: 25 }, "USD")).toBe(75);
  });
  it("rounds the product", () => {
    expect(lineAmount({ qty: 3, rate: 9.999 }, "USD")).toBe(30);
  });
  it("treats non-finite as 0", () => {
    expect(lineAmount({ qty: NaN, rate: 10 }, "USD")).toBe(0);
  });
});

describe("computeTotals", () => {
  it("sums lines with no tax/discount", () => {
    const t = computeTotals({
      currency: "USD",
      lines: [
        { qty: 2, rate: 50, taxRate: 0 },
        { qty: 1, rate: 30, taxRate: 0 },
      ],
    });
    expect(t.subtotal).toBe(130);
    expect(t.taxTotal).toBe(0);
    expect(t.total).toBe(130);
  });

  it("applies per-line tax", () => {
    const t = computeTotals({
      currency: "USD",
      lines: [{ qty: 1, rate: 100, taxRate: 10 }],
    });
    expect(t.subtotal).toBe(100);
    expect(t.taxTotal).toBe(10);
    expect(t.total).toBe(110);
  });

  it("applies discount and reduces taxable base proportionally", () => {
    // subtotal 200, discount 20 -> factor 0.9; tax 10% on 180 = 18
    const t = computeTotals({
      currency: "USD",
      discount: 20,
      lines: [{ qty: 2, rate: 100, taxRate: 10 }],
    });
    expect(t.subtotal).toBe(200);
    expect(t.discount).toBe(20);
    expect(t.taxTotal).toBe(18);
    expect(t.total).toBe(198);
  });

  it("clamps discount to subtotal and never goes negative", () => {
    const t = computeTotals({
      currency: "USD",
      discount: 9999,
      lines: [{ qty: 1, rate: 50, taxRate: 0 }],
    });
    expect(t.discount).toBe(50);
    expect(t.total).toBe(0);
  });

  it("ignores negative discount", () => {
    const t = computeTotals({
      currency: "USD",
      discount: -10,
      lines: [{ qty: 1, rate: 50, taxRate: 0 }],
    });
    expect(t.discount).toBe(0);
    expect(t.total).toBe(50);
  });

  it("handles mixed tax rates across lines", () => {
    const t = computeTotals({
      currency: "USD",
      lines: [
        { qty: 1, rate: 100, taxRate: 10 }, // tax 10
        { qty: 1, rate: 100, taxRate: 0 }, // tax 0
      ],
    });
    expect(t.subtotal).toBe(200);
    expect(t.taxTotal).toBe(10);
    expect(t.total).toBe(210);
  });

  it("empty invoice is all zeros", () => {
    const t = computeTotals({ currency: "USD", lines: [] });
    expect(t).toMatchObject({ subtotal: 0, taxTotal: 0, discount: 0, shipping: 0, total: 0 });
  });

  it("shipping is added after tax, untaxed and undiscounted", () => {
    const t = computeTotals({
      currency: "USD",
      discount: 50,
      shipping: 25,
      lines: [{ qty: 1, rate: 100, taxRate: 10 }],
    });
    // tax on the post-discount base only: (100 − 50) × 10% = 5 — shipping excluded
    expect(t.subtotal).toBe(100);
    expect(t.discount).toBe(50);
    expect(t.taxTotal).toBe(5);
    expect(t.shipping).toBe(25);
    expect(t.total).toBe(80); // 100 − 50 + 5 + 25
  });

  it("negative shipping is clamped to zero", () => {
    const t = computeTotals({ currency: "USD", shipping: -10, lines: [{ qty: 1, rate: 100, taxRate: 0 }] });
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(100);
  });

  it("shipping rounds to currency precision (zero-decimal)", () => {
    const t = computeTotals({ currency: "JPY", shipping: 499.6, lines: [{ qty: 1, rate: 1000, taxRate: 0 }] });
    expect(t.shipping).toBe(500);
    expect(t.total).toBe(1500);
  });
});

describe("balanceDue", () => {
  it("subtracts payments", () => {
    expect(balanceDue(100, [{ amount: 30 }, { amount: 20 }], "USD")).toBe(50);
  });
  it("never negative on overpayment", () => {
    expect(balanceDue(100, [{ amount: 150 }], "USD")).toBe(0);
  });
});

describe("isOverdue", () => {
  const today = "2026-06-03";
  it("is overdue when past due and unpaid", () => {
    expect(isOverdue({ status: "sent", dueDate: "2026-05-01" }, today)).toBe(true);
  });
  it("is not overdue when paid", () => {
    expect(isOverdue({ status: "paid", dueDate: "2026-05-01", paidAt: "x" }, today)).toBe(false);
  });
  it("drafts are never overdue", () => {
    expect(isOverdue({ status: "draft", dueDate: "2026-05-01" }, today)).toBe(false);
  });
  it("no due date is never overdue", () => {
    expect(isOverdue({ status: "sent" }, today)).toBe(false);
  });
});
