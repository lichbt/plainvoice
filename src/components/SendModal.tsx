import { useState } from "react";
import { useEscape } from "../lib/useEscape";
import { formatMoney } from "../lib/totals";
import { buildInvoicePdf } from "../lib/pdf";
import type { PreviewData } from "./InvoicePreview";

// Send via the user's own channels — Flow 4. No server, nothing routed through us:
//  • Mobile (navigator.canShare with files) → native share sheet with the PDF attached.
//  • Else (desktop) → download the PDF + open mailto: for the user to attach.
function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File([new Uint8Array(1)], "x.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function SendModal({
  to,
  number,
  total,
  currency,
  dueDate,
  businessName,
  paymentLink,
  docNoun = "Invoice",
  preview,
  onClose,
  onSent,
}: {
  to: string;
  number: string;
  total: number;
  currency: string;
  dueDate?: string;
  businessName: string;
  paymentLink?: string;
  docNoun?: string;
  preview: PreviewData;
  onClose: () => void;
  onSent: () => void; // mark sent + (first time) donate prompt
}) {
  const noun = docNoun.toLowerCase();
  const shareMode = canShareFiles();
  const [recipient, setRecipient] = useState(to);
  const [subject, setSubject] = useState(`${docNoun} ${number} from ${businessName}`);
  const defaultBody =
    `Hi,\n\nPlease find ${noun} ${number} for ${formatMoney(total, currency)}${dueDate ? `, due ${dueDate}` : ""} attached.` +
    (paymentLink ? `\n\nYou can pay online here: ${paymentLink}` : "") +
    `\n\nThank you,\n${businessName}`;
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  useEscape(onClose, !sending);

  async function makePdfFile(): Promise<File> {
    const bytes = await buildInvoicePdf(preview);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new File([buf], `${number || "invoice"}.pdf`, { type: "application/pdf" });
  }

  async function go() {
    setSending(true);
    try {
      const file = await makePdfFile();
      if (shareMode) {
        // native share sheet — recipient is chosen there; subject/body ride as text
        await navigator.share({ files: [file], title: subject, text: body });
      } else {
        // desktop fallback: download the PDF, then open the user's email client
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
        window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      onSent();
      onClose();
    } catch {
      // user cancelled the share sheet (or share failed) — don't mark sent
      setSending(false);
    }
  }

  return (
    <div className="overlay" onClick={sending ? undefined : onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        {!sending && <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>}
        <h3>Send {noun}</h3>
        <p className="m-lead">
          {shareMode
            ? "Opens your device's share sheet with the PDF attached — pick Mail, WhatsApp, Messages, anywhere. Nothing routed through us."
            : "We open it in your own email app and download the PDF to attach. Your mail, your sender — nothing routed through us."}
        </p>
        {!shareMode && (
          <div className="fld"><label>To</label><input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="client@email.com" /></div>
        )}
        <div className="fld"><label>Subject</label><input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="fld"><label>Message</label><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        {!shareMode && (
          <div style={{ fontSize: ".74rem", color: "var(--ink-faint)" }}>The {noun} PDF downloads when you send — attach it in your email app.</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={go} disabled={sending}>
            {sending ? "…" : shareMode ? `Share ${noun}` : "Download PDF & open email"}
          </button>
        </div>
      </div>
    </div>
  );
}
