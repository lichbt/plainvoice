import { useState } from "react";
import { formatMoney } from "../lib/totals";

// Send via the user's own email (Spec §5): build a mailto and download the PDF to attach.
// No server, no hosted sending in Phase 1.
export function SendModal({
  to,
  number,
  total,
  currency,
  dueDate,
  businessName,
  paymentLink,
  onClose,
  onSend,
}: {
  to: string;
  number: string;
  total: number;
  currency: string;
  dueDate?: string;
  businessName: string;
  paymentLink?: string;
  onClose: () => void;
  onSend: () => Promise<void>; // downloads PDF + marks sent
}) {
  const [recipient, setRecipient] = useState(to);
  const [subject, setSubject] = useState(`Invoice ${number} from ${businessName}`);
  const defaultBody =
    `Hi,\n\nPlease find invoice ${number} for ${formatMoney(total, currency)}${dueDate ? `, due ${dueDate}` : ""} attached.` +
    (paymentLink ? `\n\nYou can pay online here: ${paymentLink}` : "") +
    `\n\nThank you,\n${businessName}`;
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  async function go() {
    setSending(true);
    await onSend(); // triggers the PDF download + status → sent
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    onClose();
  }

  return (
    <div className="overlay" onClick={sending ? undefined : onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        {!sending && <button className="x" onClick={onClose} aria-label="Close">×</button>}
        <h3>Send invoice</h3>
        <p className="m-lead">We open it in your own email app and download the PDF to attach. Your mail, your sender — nothing routed through us.</p>
        <div className="fld"><label>To</label><input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="client@email.com" /></div>
        <div className="fld"><label>Subject</label><input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="fld"><label>Message</label><textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div style={{ fontSize: ".74rem", color: "var(--ink-faint)" }}>The invoice PDF downloads when you send — attach it in your email app.</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={go} disabled={sending || !recipient}>Download PDF &amp; open email</button>
        </div>
      </div>
    </div>
  );
}
