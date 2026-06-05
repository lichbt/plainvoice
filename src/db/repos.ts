// Typed CRUD layer over Dexie. The UI talks to these, never to db directly,
// so invariants (recomputed totals, timestamps, ids) live in one place.

import { db, newId } from "./db";
import type {
  Business,
  Client,
  Invoice,
  InvoiceLine,
  Item,
  Payment,
} from "./types";
import { computeTotals } from "../lib/totals";

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- Business ---------- */
export const businesses = {
  all: () => db.businesses.toArray(),
  get: (id: string) => db.businesses.get(id),
  save: async (b: Omit<Business, "id"> & { id?: string }): Promise<Business> => {
    const rec: Business = { ...b, id: b.id ?? newId() };
    await db.businesses.put(rec);
    return rec;
  },
};

/* ---------- Clients ---------- */
export const clients = {
  all: () => db.clients.orderBy("name").toArray(),
  get: (id: string) => db.clients.get(id),
  save: async (c: Omit<Client, "id"> & { id?: string }): Promise<Client> => {
    const rec: Client = { ...c, id: c.id ?? newId() };
    await db.clients.put(rec);
    return rec;
  },
  remove: (id: string) => db.clients.delete(id),
};

/* ---------- Items (catalog) ---------- */
export const items = {
  all: () => db.items.orderBy("name").toArray(),
  save: async (i: Omit<Item, "id"> & { id?: string }): Promise<Item> => {
    const rec: Item = { ...i, id: i.id ?? newId() };
    await db.items.put(rec);
    return rec;
  },
  /** Add to the catalog, or update the rate of an existing item with the same name. */
  upsertByName: async (name: string, defaultRate: number, unit?: string): Promise<Item> => {
    const trimmed = name.trim();
    const existing = (await db.items.toArray()).find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
    const rec: Item = { id: existing?.id ?? newId(), name: trimmed, defaultRate, unit: unit ?? existing?.unit, taxRate: existing?.taxRate };
    await db.items.put(rec);
    return rec;
  },
  remove: (id: string) => db.items.delete(id),
};

/* ---------- Invoices (+ lines) ---------- */

export interface InvoiceDraft {
  id?: string;
  clientId?: string;
  number: string;
  docType?: Invoice["docType"];
  status?: Invoice["status"];
  issueDate: string;
  dueDate?: string;
  currency: string;
  discount?: number;
  notes?: string;
  terms?: string;
  template?: string;
  accentColor?: string;
  lines: Array<Omit<InvoiceLine, "invoiceId" | "amount" | "id"> & { id?: string }>;
}

export interface InvoiceWithLines {
  invoice: Invoice;
  lines: InvoiceLine[];
}

export const invoices = {
  list: () => db.invoices.orderBy("updatedAt").reverse().toArray(),

  async getWithLines(id: string): Promise<InvoiceWithLines | undefined> {
    const invoice = await db.invoices.get(id);
    if (!invoice) return undefined;
    const lines = await db.invoiceLines.where("invoiceId").equals(id).toArray();
    return { invoice, lines };
  },

  /** Create or update an invoice; ALL totals are recomputed here (Hard Rule #2). */
  async save(draft: InvoiceDraft): Promise<InvoiceWithLines> {
    const id = draft.id ?? newId();
    const totals = computeTotals({
      currency: draft.currency,
      discount: draft.discount,
      lines: draft.lines,
    });

    const existing = draft.id ? await db.invoices.get(draft.id) : undefined;
    const invoice: Invoice = {
      id,
      clientId: draft.clientId,
      number: draft.number,
      docType: draft.docType ?? existing?.docType ?? "invoice",
      status: draft.status ?? existing?.status ?? "draft",
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      currency: draft.currency,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      discount: totals.discount,
      total: totals.total,
      notes: draft.notes,
      terms: draft.terms,
      template: draft.template ?? existing?.template,
      accentColor: draft.accentColor ?? existing?.accentColor,
      publicToken: existing?.publicToken,
      viewedAt: existing?.viewedAt,
      paidAt: existing?.paidAt,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };

    const lines: InvoiceLine[] = draft.lines.map((l, i) => ({
      id: l.id ?? newId(),
      invoiceId: id,
      description: l.description,
      qty: l.qty,
      rate: l.rate,
      taxRate: l.taxRate,
      amount: totals.lineAmounts[i],
    }));

    await db.transaction("rw", db.invoices, db.invoiceLines, async () => {
      await db.invoices.put(invoice);
      await db.invoiceLines.where("invoiceId").equals(id).delete();
      await db.invoiceLines.bulkPut(lines);
    });

    return { invoice, lines };
  },

  async setStatus(id: string, status: Invoice["status"]): Promise<void> {
    const patch: Partial<Invoice> = { status, updatedAt: now() };
    if (status === "paid") patch.paidAt = now();
    await db.invoices.update(id, patch);
  },

  async remove(id: string): Promise<void> {
    await db.transaction("rw", db.invoices, db.invoiceLines, db.payments, async () => {
      await db.invoices.delete(id);
      await db.invoiceLines.where("invoiceId").equals(id).delete();
      await db.payments.where("invoiceId").equals(id).delete();
    });
  },

  /** Next sequential number per doc type: INV-0007 / EST-0007 (separate sequences). */
  async nextNumber(docType: Invoice["docType"] = "invoice"): Promise<string> {
    const prefix = docType === "estimate" ? "EST-" : "INV-";
    const all = await db.invoices.toArray();
    let max = 0;
    for (const inv of all) {
      if ((inv.docType ?? "invoice") !== docType) continue;
      const m = inv.number.match(/(\d+)\s*$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `${prefix}${String(max + 1).padStart(4, "0")}`;
  },

  /** Create a new invoice from an estimate, copying client/lines/totals/styling. */
  async convertToInvoice(estimateId: string): Promise<string> {
    const found = await this.getWithLines(estimateId);
    if (!found) throw new Error("Estimate not found");
    const { invoice: est, lines } = found;
    const number = await this.nextNumber("invoice");
    const { invoice } = await this.save({
      clientId: est.clientId,
      number,
      docType: "invoice",
      status: "draft",
      issueDate: today(),
      dueDate: undefined,
      currency: est.currency,
      discount: est.discount,
      notes: est.notes,
      terms: est.terms,
      template: est.template,
      accentColor: est.accentColor,
      lines: lines.map((l) => ({ description: l.description, qty: l.qty, rate: l.rate, taxRate: l.taxRate })),
    });
    return invoice.id;
  },
};

/* ---------- Payments ---------- */
export const payments = {
  forInvoice: (invoiceId: string) =>
    db.payments.where("invoiceId").equals(invoiceId).toArray(),

  async record(p: Omit<Payment, "id" | "paidAt"> & { id?: string; paidAt?: string }): Promise<Payment> {
    const rec: Payment = {
      id: p.id ?? newId(),
      invoiceId: p.invoiceId,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt ?? now(),
      ref: p.ref,
    };
    await db.payments.put(rec);
    return rec;
  },
};

export { today };
