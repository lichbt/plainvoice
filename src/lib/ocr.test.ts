import { describe, it, expect } from "vitest";
import { parseLines } from "./ocr";

describe("parseLines", () => {
  it("extracts description + amount", () => {
    const r = parseLines("Brand identity design   1,800.00\nWeb mockups  720.00");
    expect(r).toEqual([
      { description: "Brand identity design", qty: 1, rate: 1800 },
      { description: "Web mockups", qty: 1, rate: 720 },
    ]);
  });

  it("reads a leading quantity", () => {
    const r = parseLines("3 x Revision round  120.00");
    expect(r[0]).toEqual({ description: "Revision round", qty: 3, rate: 120 });
  });

  it("skips totals / tax / header lines", () => {
    const r = parseLines("Subtotal 100.00\nTax 10.00\nTotal 110.00\nConsulting 90.00");
    expect(r).toEqual([{ description: "Consulting", qty: 1, rate: 90 }]);
  });

  it("ignores lines without an amount", () => {
    expect(parseLines("Just some notes here\nThank you")).toEqual([]);
  });

  it("handles a $ prefix", () => {
    expect(parseLines("Call-out fee $90.00")).toEqual([{ description: "Call-out fee", qty: 1, rate: 90 }]);
  });
});
