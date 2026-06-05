// Data model — mirrors Build Spec §10. Local-first; lives in IndexedDB via Dexie.
// publicToken / viewedAt / paidAt exist now but stay null in Phase 1 (no server).

// invoice statuses + estimate statuses (accepted/declined). "overdue" is derived.
export type InvoiceStatus = "draft" | "sent" | "viewed" | "paid" | "overdue" | "accepted" | "declined";
export type DocType = "invoice" | "estimate";
export type PaymentMethod = "stripe" | "paypal" | "bank" | "cash" | "other";
export type Plan = "free" | "pro";

export interface Business {
  id: string;
  name: string;
  logoDataUrl?: string;
  address?: string;
  email?: string;
  defaultCurrency: string; // ISO 4217, e.g. "USD"
  taxId?: string;
  senderName?: string;
  paymentLink?: string; // user's own Stripe/PayPal link — 0% fee, shown on invoice (Spec §5)
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  address?: string;
  defaultTerms?: string;
  currency?: string;
  notes?: string;
}

export interface Item {
  id: string;
  name: string;
  defaultRate: number;
  unit?: string;
  taxRate?: number; // percent, e.g. 10 = 10%
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  qty: number;
  rate: number;
  taxRate: number; // percent
  amount: number; // qty * rate, recomputed in code (never trusted from input)
}

export interface Invoice {
  id: string;
  clientId?: string;
  number: string;
  docType?: DocType; // undefined = invoice (back-compat); "estimate" for quotes
  status: InvoiceStatus;
  issueDate: string; // ISO date (YYYY-MM-DD)
  dueDate?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  discount: number; // absolute amount in currency
  total: number;
  notes?: string;
  terms?: string;
  template?: string; // template id (see lib/templates.ts)
  accentColor?: string; // optional accent override (hex)
  publicToken?: string; // Phase 2 tracked link only
  viewedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  ref?: string;
}

export interface Reminder {
  id: string;
  invoiceId: string;
  tone: "friendly" | "firm" | "final";
  scheduledFor?: string;
  sentAt?: string;
  body: string;
  aiGenerated: boolean;
}

export interface Settings {
  id: "singleton";
  plan: Plan;
  aiCreditsRemaining: number;
  activeBusinessId?: string;
}
