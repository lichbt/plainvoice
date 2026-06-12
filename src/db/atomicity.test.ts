// Concurrency invariants on the local DB: the AI-uses counter must not lose
// updates, and two simultaneous first-saves must not keep the same number.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureSettings, consumeAiUse, grantAiUses, FREE_AI_USES } from "./db";
import { invoices } from "./repos";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("AI-uses counter atomicity", () => {
  it("concurrent consumes each take exactly one use", async () => {
    await ensureSettings();
    await Promise.all([consumeAiUse(), consumeAiUse(), consumeAiUse()]);
    const s = await db.settings.get("singleton");
    expect(s?.aiUsesLeft).toBe(FREE_AI_USES - 3);
  });

  it("a grant racing a consume nets out correctly", async () => {
    await ensureSettings();
    await Promise.all([grantAiUses(50), consumeAiUse()]);
    const s = await db.settings.get("singleton");
    expect(s?.aiUsesLeft).toBe(FREE_AI_USES + 50 - 1);
  });

  it("never goes below zero", async () => {
    await ensureSettings();
    await db.settings.update("singleton", { aiUsesLeft: 1 });
    await Promise.all([consumeAiUse(), consumeAiUse()]);
    const s = await db.settings.get("singleton");
    expect(s?.aiUsesLeft).toBe(0);
  });
});

describe("invoice number uniqueness", () => {
  const draft = (number: string) => ({
    number,
    issueDate: "2026-06-12",
    currency: "USD",
    lines: [{ description: "Work", qty: 1, rate: 100, taxRate: 0 }],
  });

  it("re-mints when two fresh invoices arrive with the same auto-number", async () => {
    const [a, b] = await Promise.all([
      invoices.save(draft("INV-0001")),
      invoices.save(draft("INV-0001")),
    ]);
    expect(a.invoice.number).not.toBe(b.invoice.number);
    const numbers = (await db.invoices.toArray()).map((i) => i.number).sort();
    expect(new Set(numbers).size).toBe(2);
  });

  it("keeps a deliberate custom number even if it clashes", async () => {
    await invoices.save(draft("CUSTOM-7"));
    const second = await invoices.save(draft("CUSTOM-7"));
    expect(second.invoice.number).toBe("CUSTOM-7");
  });

  it("updating an existing invoice never renumbers it", async () => {
    const { invoice } = await invoices.save(draft("INV-0001"));
    const updated = await invoices.save({ ...draft("INV-0001"), id: invoice.id });
    expect(updated.invoice.number).toBe("INV-0001");
  });

  it("nextNumber continues each doc-type sequence independently", async () => {
    await invoices.save(draft("INV-0003"));
    expect(await invoices.nextNumber("invoice")).toBe("INV-0004");
    expect(await invoices.nextNumber("estimate")).toBe("EST-0001");
  });
});
