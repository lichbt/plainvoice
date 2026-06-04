// CSV import — a free switching wedge (Spec §5). Parse + map to local records.
// Always recomputes totals in code (Hard Rule #2); imported invoices land as drafts.
import Papa from "papaparse";
import { clients as clientRepo, invoices as invoiceRepo } from "../db/repos";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => resolve({ headers: res.meta.fields ?? [], rows: res.data }),
      error: reject,
    });
  });
}

// pick the first present key from a list of aliases
const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (row[k] != null && row[k] !== "") return String(row[k]).trim();
  return "";
};
const numOf = (s: string) => { const n = parseFloat(String(s).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };

export async function importClients(rows: Record<string, string>[]): Promise<number> {
  let count = 0;
  for (const row of rows) {
    const name = pick(row, "name", "client", "client name", "company");
    if (!name) continue;
    await clientRepo.save({
      name,
      email: pick(row, "email", "e-mail") || undefined,
      address: pick(row, "address", "billing address") || undefined,
      notes: pick(row, "notes", "note", "phone") || undefined,
    });
    count++;
  }
  return count;
}

/**
 * Flat invoice CSV: rows grouped by invoice number. Each row is one line item:
 * number, client, issuedate, duedate, currency, description, qty, rate, taxrate
 */
export async function importInvoices(rows: Record<string, string>[]): Promise<number> {
  const groups = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const number = pick(row, "number", "invoice", "invoice #", "invoice number", "no");
    if (!number) continue;
    (groups.get(number) ?? groups.set(number, []).get(number)!).push(row);
  }

  // ensure clients exist by name; reuse existing
  const existing = await clientRepo.all();
  const clientByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

  let count = 0;
  for (const [number, group] of groups) {
    const head = group[0];
    const clientName = pick(head, "client", "client name", "customer", "bill to");
    let clientId: string | undefined;
    if (clientName) {
      const found = clientByName.get(clientName.toLowerCase());
      const c = found ?? (await clientRepo.save({ name: clientName }));
      if (!found) clientByName.set(clientName.toLowerCase(), c);
      clientId = c.id;
    }
    await invoiceRepo.save({
      clientId,
      number,
      status: "draft",
      issueDate: pick(head, "issuedate", "issue date", "date") || new Date().toISOString().slice(0, 10),
      dueDate: pick(head, "duedate", "due date", "due") || undefined,
      currency: pick(head, "currency") || "USD",
      discount: numOf(pick(head, "discount")),
      notes: pick(head, "notes", "note") || undefined,
      lines: group.map((r) => ({
        description: pick(r, "description", "item", "line", "details") || "Item",
        qty: numOf(pick(r, "qty", "quantity")) || 1,
        rate: numOf(pick(r, "rate", "price", "unit price", "amount")),
        taxRate: numOf(pick(r, "taxrate", "tax", "tax %", "vat")),
      })),
    });
    count++;
  }
  return count;
}
