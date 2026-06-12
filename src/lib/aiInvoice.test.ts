import { describe, it, expect } from "vitest";
import { parseAiDraft } from "./aiInvoice";

describe("parseAiDraft", () => {
  it("maps clean lines with qty + unit rate", () => {
    const d = parseAiDraft({ lines: [{ description: "Design", qty: 8, rate: 150 }] });
    expect(d.lines).toEqual([{ description: "Design", qty: 8, rate: 150 }]);
  });

  it("defaults qty to 1 when missing or invalid", () => {
    const d = parseAiDraft({ lines: [{ description: "Logo", rate: 200 }, { description: "Setup", qty: 0, rate: 50 }] });
    expect(d.lines).toEqual([
      { description: "Logo", qty: 1, rate: 200 },
      { description: "Setup", qty: 1, rate: 50 },
    ]);
  });

  it("coerces stringy numbers", () => {
    const d = parseAiDraft({ lines: [{ description: "Hours", qty: "3", rate: "90.5" }] });
    expect(d.lines[0]).toEqual({ description: "Hours", qty: 3, rate: 90.5 });
  });

  it("drops malformed lines (no description or non-numeric rate)", () => {
    const d = parseAiDraft({ lines: [
      { description: "", rate: 10 },
      { description: "Valid", rate: 10 },
      { description: "NoRate", rate: "abc" },
      "garbage",
    ] });
    expect(d.lines).toEqual([{ description: "Valid", qty: 1, rate: 10 }]);
  });

  it("keeps clientName, dueInDays, notes when present", () => {
    const d = parseAiDraft({ lines: [{ description: "x", rate: 1 }], clientName: " Acme ", dueInDays: 30, notes: "Thanks" });
    expect(d.clientName).toBe("Acme");
    expect(d.dueInDays).toBe(30);
    expect(d.notes).toBe("Thanks");
  });

  it("only accepts a currency we support", () => {
    expect(parseAiDraft({ lines: [], currency: "eur" }).currency).toBe("EUR");
    expect(parseAiDraft({ lines: [], currency: "XYZ" }).currency).toBeUndefined();
  });

  it("ignores out-of-range dueInDays", () => {
    expect(parseAiDraft({ lines: [], dueInDays: -5 }).dueInDays).toBeUndefined();
    expect(parseAiDraft({ lines: [], dueInDays: 9999 }).dueInDays).toBeUndefined();
  });

  it("handles empty / junk input safely", () => {
    expect(parseAiDraft(null).lines).toEqual([]);
    expect(parseAiDraft({}).lines).toEqual([]);
    expect(parseAiDraft("nope").lines).toEqual([]);
  });

  it("accepts a PO number and trims/caps it", () => {
    expect(parseAiDraft({ lines: [], poNumber: "  PO-4521  " }).poNumber).toBe("PO-4521");
    expect(parseAiDraft({ lines: [], poNumber: "x".repeat(100) }).poNumber).toHaveLength(60);
    expect(parseAiDraft({ lines: [], poNumber: "" }).poNumber).toBeUndefined();
    expect(parseAiDraft({ lines: [], poNumber: 42 }).poNumber).toBeUndefined();
  });

  it("accepts positive shipping only", () => {
    expect(parseAiDraft({ lines: [], shipping: 25 }).shipping).toBe(25);
    expect(parseAiDraft({ lines: [], shipping: "12.5" }).shipping).toBe(12.5);
    expect(parseAiDraft({ lines: [], shipping: -3 }).shipping).toBeUndefined();
    expect(parseAiDraft({ lines: [], shipping: "junk" }).shipping).toBeUndefined();
  });
});
