// Live preview, styled to the prototype's .preview layout. Mirrors the PDF (pdf.ts).
import { useEffect, useState } from "react";
import type { Business, Client } from "../db/types";
import { formatMoney } from "../lib/totals";
import { getTemplate, resolveAccent, ON_ACCENT } from "../lib/templates";
import { qrDataUrl } from "../lib/qr";

function PayQr({ text }: { text: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let alive = true;
    qrDataUrl(text, 220).then((d) => { if (alive) setSrc(d); }).catch(() => {});
    return () => { alive = false; };
  }, [text]);
  if (!src) return null;
  return <img src={src} alt="Scan to pay" width={88} height={88} style={{ marginTop: ".5rem", display: "block" }} />;
}

export interface PreviewLine {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface PreviewData {
  business?: Pick<Business, "name" | "logoDataUrl" | "address" | "email" | "taxId">;
  client?: Pick<Client, "name" | "email" | "address">;
  number: string;
  docType?: "invoice" | "estimate";
  status: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  lines: PreviewLine[];
  subtotal: number;
  taxTotal: number;
  discount: number;
  total: number;
  paid?: number; // sum of recorded payments
  notes?: string;
  terms?: string;
  paymentLink?: string;
  template?: string;
  accentColor?: string;
}

export function InvoicePreview({ data }: { data: PreviewData }) {
  const m = (n: number) => formatMoney(n, data.currency);
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);
  const tpl = getTemplate(data.template);
  const accent = resolveAccent(tpl, data.accentColor);
  const docNoun = data.docType === "estimate" ? "Estimate" : "Invoice";
  // accent drives an inline CSS var; header style + font are classes
  const rootStyle = { ["--tpl-accent" as string]: accent, ["--tpl-on-accent" as string]: ON_ACCENT } as React.CSSProperties;

  const header = (
    <div className="pv-top">
      <div>
        {data.business?.logoDataUrl ? <img className="pv-logo" src={data.business.logoDataUrl} alt="" /> : null}
        <div className="pv-co">
          {data.business?.name || "Your business"}
          <small>{[data.business?.email, data.currency].filter(Boolean).join(" · ")}</small>
        </div>
      </div>
      <div className="pv-inv-no">
        <span className="big">{docNoun} #{data.number}</span>
        Issued {data.issueDate || "—"}
        {data.dueDate ? <><br />Due {data.dueDate}</> : null}
      </div>
    </div>
  );

  return (
    <div className={`preview tpl-${tpl.headerStyle} tpl-font-${tpl.font}`} style={rootStyle}>
      {tpl.headerStyle === "band" ? <div className="pv-band">{header}</div> : header}

      <div className="pv-parties">
        <div>
          <div className="h">Billed to</div>
          <div className="nm">{data.client?.name || "—"}</div>
          {data.client?.email ? <div style={{ color: "var(--ink-faint)" }}>{data.client.email}</div> : null}
          {data.client?.address ? <div style={{ color: "var(--ink-faint)", whiteSpace: "pre-line" }}>{data.client.address}</div> : null}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="h">Status</div>
          <div className="nm">{statusLabel}</div>
        </div>
      </div>

      <table className="pv-tbl">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 ? (
            <tr><td colSpan={4} style={{ color: "var(--ink-faint)", textAlign: "center" }}>No line items yet</td></tr>
          ) : (
            data.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.description || "—"}</td>
                <td className="num">{l.qty}</td>
                <td className="num">{m(l.rate)}</td>
                <td className="num">{m(l.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="pv-tot">
        <div className="r"><span>Subtotal</span><span className="mono">{m(data.subtotal)}</span></div>
        {data.taxTotal > 0 ? <div className="r"><span>Tax</span><span className="mono">{m(data.taxTotal)}</span></div> : null}
        {data.discount > 0 ? <div className="r"><span>Discount</span><span className="mono">−{m(data.discount)}</span></div> : null}
        {data.paid && data.paid > 0 ? (
          <>
            <div className="r"><span>Total</span><span className="mono">{m(data.total)}</span></div>
            <div className="r"><span>Paid</span><span className="mono">−{m(data.paid)}</span></div>
            <div className="r g"><span>Balance due</span><span className="mono v">{m(Math.max(data.total - data.paid, 0))}</span></div>
          </>
        ) : (
          <div className="r g"><span>{data.docType === "estimate" ? "Total" : "Total due"}</span><span className="mono v">{m(data.total)}</span></div>
        )}
      </div>

      {(data.notes || data.terms || data.paymentLink) && (
        <div className="pv-foot">
          {data.paymentLink ? <div><strong style={{ color: "var(--accent)" }}>Pay online:</strong> {data.paymentLink}<PayQr text={data.paymentLink} /></div> : null}
          {data.notes ? <div>{data.notes}</div> : null}
          {data.terms ? <div>{data.terms}</div> : null}
        </div>
      )}
      <div className="watermark">Made with Plainvoice</div>
    </div>
  );
}
