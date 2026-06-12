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

/* ---- Full JSON backup / restore — the real "no hostages" guarantee.
   CSV is lossy (no line items, payments, business profile); this is the
   complete database, re-importable on any device. ---- */

const BACKUP_FORMAT = 1;

export interface BackupData {
  businesses: unknown[];
  clients: unknown[];
  items: unknown[];
  invoices: unknown[];
  invoiceLines: unknown[];
  payments: unknown[];
  reminders: unknown[];
  settings: unknown[];
}

/** Download the entire database as one JSON file. Returns total record count. */
export async function exportBackupJson(): Promise<number> {
  const [businesses, clients, items, invoices, invoiceLines, payments, reminders, settings] =
    await Promise.all([
      db.businesses.toArray(), db.clients.toArray(), db.items.toArray(),
      db.invoices.toArray(), db.invoiceLines.toArray(), db.payments.toArray(),
      db.reminders.toArray(), db.settings.toArray(),
    ]);
  const backup = {
    app: "plainvoice",
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    data: { businesses, clients, items, invoices, invoiceLines, payments, reminders, settings },
  };
  download(`plainvoice-backup-${todayStr()}.json`, JSON.stringify(backup, null, 2), "application/json");
  return businesses.length + clients.length + items.length + invoices.length +
    invoiceLines.length + payments.length + reminders.length;
}

/** Validate backup text and normalize it to table arrays. Throws a user-readable error. */
export function parseBackup(text: string): BackupData {
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  if (parsed?.app !== "plainvoice" || typeof parsed.data !== "object" || parsed.data === null) {
    throw new Error("That doesn't look like a Plainvoice backup file.");
  }
  if (typeof parsed.format === "number" && parsed.format > BACKUP_FORMAT) {
    throw new Error("This backup was made by a newer version of Plainvoice — update the app first.");
  }
  // keep only well-formed rows (objects with a string id) so a hand-edited
  // file can't plant junk the app would choke on later
  const rows = (x: unknown) =>
    Array.isArray(x) ? x.filter((r) => r && typeof r === "object" && typeof (r as any).id === "string") : [];
  const d = parsed.data;
  return {
    businesses: rows(d.businesses), clients: rows(d.clients), items: rows(d.items),
    invoices: rows(d.invoices), invoiceLines: rows(d.invoiceLines), payments: rows(d.payments),
    reminders: rows(d.reminders), settings: rows(d.settings),
  };
}

/** Merge a backup into the database (same ids overwrite, everything else is kept). */
export async function importBackupJson(text: string): Promise<{ invoices: number; clients: number }> {
  const d = parseBackup(text);
  await db.transaction(
    "rw",
    [db.businesses, db.clients, db.items, db.invoices, db.invoiceLines, db.payments, db.reminders, db.settings],
    async () => {
      await db.businesses.bulkPut(d.businesses as any);
      await db.clients.bulkPut(d.clients as any);
      await db.items.bulkPut(d.items as any);
      await db.invoices.bulkPut(d.invoices as any);
      await db.invoiceLines.bulkPut(d.invoiceLines as any);
      await db.payments.bulkPut(d.payments as any);
      await db.reminders.bulkPut(d.reminders as any);
      // settings: restoring a backup must never downgrade AI uses bought since
      const incoming = (d.settings as any[]).find((s) => s.id === "singleton");
      if (incoming) {
        const current = await db.settings.get("singleton");
        await db.settings.put({
          ...incoming,
          aiUsesLeft: Math.max(current?.aiUsesLeft ?? 0, incoming.aiUsesLeft ?? 0),
        });
      }
    },
  );
  return { invoices: d.invoices.length, clients: d.clients.length };
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
