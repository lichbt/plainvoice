// Build a PreviewData (used by preview + PDF) from stored records.
import type { Business, Client, Invoice, InvoiceLine } from "../db/types";
import type { PreviewData } from "../components/InvoicePreview";
import { isOverdue } from "./totals";

export function buildPreviewData(
  invoice: Invoice,
  lines: InvoiceLine[],
  business?: Business,
  client?: Client,
  today?: string,
  paid?: number,
): PreviewData {
  const status = today && isOverdue(invoice, today) ? "overdue" : invoice.status;
  return {
    business: business
      ? { name: business.name, logoDataUrl: business.logoDataUrl, address: business.address, email: business.email, taxId: business.taxId }
      : undefined,
    client: client ? { name: client.name, email: client.email, address: client.address } : undefined,
    number: invoice.number,
    status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    lines: lines.map((l) => ({ description: l.description, qty: l.qty, rate: l.rate, amount: l.amount })),
    subtotal: invoice.subtotal,
    taxTotal: invoice.taxTotal,
    discount: invoice.discount,
    total: invoice.total,
    paid,
    notes: invoice.notes,
    terms: invoice.terms,
    paymentLink: business?.paymentLink,
    template: invoice.template,
    accentColor: invoice.accentColor,
  };
}
