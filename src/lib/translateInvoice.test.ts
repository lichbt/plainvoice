import { describe, it, expect, vi } from "vitest";
import {
  applyTranslations, contentSignature, hasTranslatableText, translateContent,
  type TranslatableContent,
} from "./translateInvoice";

const sample: TranslatableContent = {
  lineDescriptions: ["Consulting", "", "Setup fee"],
  notes: "Thanks!",
  terms: undefined,
};

describe("applyTranslations", () => {
  it("zips translations back onto non-empty slots, leaving empties untouched", () => {
    // plan() skips the empty line, so order is: line0, line2, notes
    const out = applyTranslations(sample, ["Conseil", "Frais de mise en place", "Merci !"]);
    expect(out.lineDescriptions).toEqual(["Conseil", "", "Frais de mise en place"]);
    expect(out.notes).toBe("Merci !");
    expect(out.terms).toBeUndefined();
  });

  it("never invents content when translations are short", () => {
    const out = applyTranslations(sample, ["Conseil"]); // only first slot
    expect(out.lineDescriptions).toEqual(["Conseil", "", "Setup fee"]);
    expect(out.notes).toBe("Thanks!"); // untranslated slot keeps original
  });
});

describe("hasTranslatableText / signature", () => {
  it("detects free text vs. labels-only", () => {
    expect(hasTranslatableText(sample)).toBe(true);
    expect(hasTranslatableText({ lineDescriptions: ["", "  "] })).toBe(false);
  });

  it("signature changes when content changes (cache invalidation)", () => {
    const a = contentSignature(sample);
    const b = contentSignature({ ...sample, notes: "Cheers!" });
    expect(a).not.toBe(b);
  });
});

describe("translateContent", () => {
  it("English is a no-op and never billed", async () => {
    const fetchFn = vi.fn();
    const res = await translateContent(sample, "en", undefined, fetchFn as unknown as typeof fetch);
    expect(res.billed).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns cache without billing when signature matches", async () => {
    const fetchFn = vi.fn();
    const cached = { sig: contentSignature(sample), content: { ...sample, notes: "cached" } };
    const res = await translateContent(sample, "fr", cached, fetchFn as unknown as typeof fetch);
    expect(res.billed).toBe(false);
    expect(res.content.notes).toBe("cached");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("calls the endpoint on a cache miss and bills once", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ translations: ["Conseil", "Frais", "Merci !"] }), { status: 200 }),
    );
    const res = await translateContent(sample, "fr", undefined, fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(res.billed).toBe(true);
    expect(res.content.lineDescriptions[0]).toBe("Conseil");
  });

  it("does not bill when the AI is not configured (503)", async () => {
    const fetchFn = vi.fn(async () => new Response('{"error":"ai_not_configured"}', { status: 503 }));
    const res = await translateContent(sample, "fr", undefined, fetchFn as unknown as typeof fetch);
    expect(res.billed).toBe(false);
    expect(res.error).toBe("ai_not_configured");
  });

  it("surfaces rate-limit without billing", async () => {
    const fetchFn = vi.fn(async () => new Response('{"error":"daily_budget"}', { status: 429 }));
    const res = await translateContent(sample, "fr", undefined, fetchFn as unknown as typeof fetch);
    expect(res.billed).toBe(false);
    expect(res.error).toBe("daily_budget");
  });

  it("labels-only content skips the network and isn't billed", async () => {
    const fetchFn = vi.fn();
    const res = await translateContent({ lineDescriptions: ["", ""] }, "fr", undefined, fetchFn as unknown as typeof fetch);
    expect(res.billed).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
