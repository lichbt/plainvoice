// Pagination: long invoices must render every line across multiple pages
// (the old MVP guard silently truncated at one page).
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildInvoicePdf } from "./pdf";
import type { PreviewData } from "../components/InvoicePreview";

function makeData(lineCount: number, extra: Partial<PreviewData> = {}): PreviewData {
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    description: `Service item ${i + 1}`,
    qty: 1,
    rate: 100,
    amount: 100,
  }));
  return {
    business: { name: "Test Studio", email: "hi@test.dev" },
    client: { name: "Acme Corp" },
    number: "INV-0001",
    docType: "invoice",
    status: "draft",
    issueDate: "2026-06-12",
    dueDate: "2026-07-12",
    currency: "USD",
    lines,
    subtotal: lineCount * 100,
    taxTotal: 0,
    discount: 0,
    total: lineCount * 100,
    ...extra,
  };
}

describe("buildInvoicePdf pagination", () => {
  it("keeps a short invoice on a single page", async () => {
    const bytes = await buildInvoicePdf(makeData(5));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("flows a long invoice onto extra pages instead of truncating", async () => {
    const bytes = await buildInvoicePdf(makeData(60));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("survives very long notes and terms", async () => {
    const para = "Payment is appreciated within the stated terms. ".repeat(60);
    const bytes = await buildInvoicePdf(makeData(40, { notes: para, terms: para }));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
