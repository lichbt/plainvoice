// Validate + normalise the AI draft from /api/ai/parse-invoice into something the
// editor can apply. PURE + defensive: never trust the model — coerce numbers, drop
// malformed lines, ignore any totals. Totals are recomputed in code downstream.
import { CURRENCIES } from "./currencies";

export interface AiLine { description: string; qty: number; rate: number }
export interface AiInvoiceDraft {
  lines: AiLine[];
  clientName?: string;
  dueInDays?: number;
  currency?: string;
  notes?: string;
  poNumber?: string;
  shipping?: number;
}

const toNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Coerce a raw `{ draft }` payload into a clean, safe AiInvoiceDraft. */
export function parseAiDraft(raw: unknown): AiInvoiceDraft {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const rawLines = Array.isArray(d.lines) ? d.lines : [];
  const lines: AiLine[] = [];
  for (const l of rawLines) {
    if (!l || typeof l !== "object") continue;
    const row = l as Record<string, unknown>;
    const description = String(row.description ?? "").trim();
    const rate = toNum(row.rate);
    if (!description || rate === null) continue; // a line needs a name + a numeric rate
    const qtyN = toNum(row.qty);
    const qty = qtyN === null || qtyN <= 0 ? 1 : qtyN;
    lines.push({ description, qty, rate });
  }

  const out: AiInvoiceDraft = { lines };

  const clientName = typeof d.clientName === "string" ? d.clientName.trim() : "";
  if (clientName) out.clientName = clientName;

  const due = toNum(d.dueInDays);
  if (due !== null && due > 0 && due <= 365) out.dueInDays = Math.round(due);

  const ccy = typeof d.currency === "string" ? d.currency.toUpperCase() : "";
  if (ccy && (CURRENCIES as readonly string[]).includes(ccy)) out.currency = ccy;

  const notes = typeof d.notes === "string" ? d.notes.trim() : "";
  if (notes) out.notes = notes;

  const po = typeof d.poNumber === "string" ? d.poNumber.trim() : "";
  if (po) out.poNumber = po.slice(0, 60);

  const ship = toNum(d.shipping);
  if (ship !== null && ship > 0) out.shipping = ship;

  return out;
}
