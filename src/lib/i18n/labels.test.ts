import { describe, it, expect } from "vitest";
import { LANGS, getLabels, getLang, formatDateFor, statusKey, DEFAULT_LANG } from "./labels";

describe("labels dictionary", () => {
  it("every language defines all keys (English-filled, never blank)", () => {
    const keys = Object.keys(getLabels("en"));
    for (const l of LANGS) {
      const dict = getLabels(l.code);
      for (const k of keys) {
        expect(dict[k as keyof typeof dict], `${l.code}.${k}`).toBeTruthy();
      }
    }
  });

  it("falls back to English for an unknown language", () => {
    expect(getLabels("xx")).toEqual(getLabels(DEFAULT_LANG));
  });

  it("translates the core labels (spot checks)", () => {
    expect(getLabels("fr").docInvoice).toBe("Facture");
    expect(getLabels("es").totalDue).toBe("Total a pagar");
    expect(getLabels("vi").subtotal).toBe("Tạm tính");
    expect(getLabels("ja").docInvoice).toBe("請求書");
  });

  it("maps status to a label key and translates it", () => {
    expect(statusKey("overdue")).toBe("st_overdue");
    expect(statusKey("paid")).toBe("st_paid");
    expect(getLabels("de")[statusKey("overdue")]).toBe("Überfällig");
    // unknown status degrades to draft, not a crash
    expect(statusKey("weird")).toBe("st_draft");
  });

  it("getLang returns the locale + script, English for unknown", () => {
    expect(getLang("th").locale).toBe("th");
    expect(getLang("th").script).toBe("thai");
    expect(getLang("zh").script).toBe("cjk");
    expect(getLang("nope").code).toBe("en");
  });
});

describe("formatDateFor", () => {
  it("formats an ISO date in the target locale, no timezone drift", () => {
    // 2026-01-05 must stay Jan 5 regardless of the runner's timezone
    const en = formatDateFor("2026-01-05", "en");
    expect(en).toMatch(/Jan/);
    expect(en).toMatch(/5/);
    expect(en).toMatch(/2026/);
  });

  it("returns a dash for empty and the raw string for malformed input", () => {
    expect(formatDateFor(undefined, "en")).toBe("—");
    expect(formatDateFor("not-a-date", "en")).toBe("not-a-date");
  });
});
