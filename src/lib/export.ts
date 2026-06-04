// Full export — the trust promise: "one-click export, any time, no hostages."
// Never gated. Produces a CSV of invoices + clients, and a merged PDF of every invoice.
import Papa from "papaparse";
import { PDFDocument } from "pdf-lib";
import { db } from "../db/db";
import { today as todayStr } from "../db/repos";
import { isOverdue } from "./totals";
import { buildPreviewData } from "./invoiceView";
import { buildInvoicePdf } from "./pdf";

function download(filename: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV with one row per invoice (status reflects overdue at export time). */
export async function exportInvoicesCsv(): Promise<number> {
  const [invoices, clients] = await Promise.all([db.invoices.toArray(), db.clients.toArray()]);
  const today = todayStr();
  const byId = new Map(clients.map((c) => [c.id, c]));
  const rows = invoices
    .sort((a, b) => a.number.localeCompare(b.number))
    .map((inv) => ({
      number: inv.number,
      client: inv.clientId ? byId.get(inv.clientId)?.name ?? "" : "",
      status: isOverdue(inv, today) ? "overdue" : inv.status,
      currency: inv.currency,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate ?? "",
      subtotal: inv.subtotal,
      tax: inv.taxTotal,
      discount: inv.discount,
      total: inv.total,
      paidAt: inv.paidAt ?? "",
    }));
  download(`plainvoice-invoices-${today}.csv`, Papa.unparse(rows), "text/csv;charset=utf-8");
  return rows.length;
}

/** CSV of the client catalog. */
export async function exportClientsCsv(): Promise<number> {
  const clients = await db.clients.toArray();
  const rows = clients.map((c) => ({ name: c.name, email: c.email ?? "", address: (c.address ?? "").replace(/\n/g, " "), notes: c.notes ?? "" }));
  download(`plainvoice-clients-${todayStr()}.csv`, Papa.unparse(rows), "text/csv;charset=utf-8");
  return rows.length;
}

/** One PDF containing every invoice, in number order. */
export async function exportAllInvoicesPdf(): Promise<number> {
  const [invoices, clients, businesses] = await Promise.all([
    db.invoices.toArray(), db.clients.toArray(), db.businesses.toArray(),
  ]);
  if (invoices.length === 0) return 0;
  const business = businesses[0];
  const byClient = new Map(clients.map((c) => [c.id, c]));
  const today = todayStr();

  const master = await PDFDocument.create();
  for (const inv of invoices.sort((a, b) => a.number.localeCompare(b.number))) {
    const [lines, pays] = await Promise.all([
      db.invoiceLines.where("invoiceId").equals(inv.id).toArray(),
      db.payments.where("invoiceId").equals(inv.id).toArray(),
    ]);
    const paid = pays.reduce((s, p) => s + p.amount, 0);
    const data = buildPreviewData(inv, lines, business, inv.clientId ? byClient.get(inv.clientId) : undefined, today, paid > 0 ? paid : undefined);
    const bytes = await buildInvoicePdf(data);
    const doc = await PDFDocument.load(bytes);
    const pages = await master.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => master.addPage(p));
  }
  const out = await master.save();
  const buf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  download(`plainvoice-all-invoices-${today}.pdf`, buf, "application/pdf");
  return invoices.length;
}
