import Dexie, { type Table } from "dexie";
import type {
  Business,
  Client,
  Item,
  Invoice,
  InvoiceLine,
  Payment,
  Reminder,
  Settings,
} from "./types";

// Local-first store. No server, no account required to use or save (Spec §4).
export class PlainvoiceDB extends Dexie {
  businesses!: Table<Business, string>;
  clients!: Table<Client, string>;
  items!: Table<Item, string>;
  invoices!: Table<Invoice, string>;
  invoiceLines!: Table<InvoiceLine, string>;
  payments!: Table<Payment, string>;
  reminders!: Table<Reminder, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("plainvoice");
    this.version(1).stores({
      businesses: "id",
      clients: "id, name",
      items: "id, name",
      // index the fields the list/search/filter screens query on
      invoices: "id, clientId, status, number, issueDate, dueDate, updatedAt",
      invoiceLines: "id, invoiceId",
      payments: "id, invoiceId",
      reminders: "id, invoiceId, scheduledFor",
      settings: "id",
    });
    // v2: index docType so the list can separate invoices from estimates
    this.version(2).stores({
      invoices: "id, clientId, status, number, docType, issueDate, dueDate, updatedAt",
    });
  }
}

export const db = new PlainvoiceDB();

export function newId(): string {
  return crypto.randomUUID();
}

/** Ensure the singleton settings row exists. Free plan, AI off — never gates the core. */
export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get("singleton");
  if (existing) return existing;
  const fresh: Settings = { id: "singleton", plan: "free", aiCreditsRemaining: 0 };
  await db.settings.put(fresh);
  return fresh;
}
