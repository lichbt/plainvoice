import { useState } from "react";
import { useEscape } from "../lib/useEscape";
import type { PaymentMethod } from "../db/types";
import { formatMoney } from "../lib/totals";

const METHODS: PaymentMethod[] = ["stripe", "paypal", "bank", "cash", "other"];

// Record a (possibly partial) payment against an invoice. Marks paid when balance clears.
export function RecordPaymentModal({
  currency,
  balanceDue,
  paidSoFar = 0,
  onClose,
  onSave,
}: {
  currency: string;
  balanceDue: number;
  paidSoFar?: number;
  onClose: () => void;
  onSave: (amount: number, method: PaymentMethod, ref?: string) => void;
}) {
  useEscape(onClose);
  const [amount, setAmount] = useState(String(balanceDue));
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [ref, setRef] = useState("");

  const amt = parseFloat(amount);
  const valid = Number.isFinite(amt) && amt > 0;
  const over = valid && amt > balanceDue;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>
        <h3>Record a payment</h3>
        <p className="m-lead">
          Balance due: <strong className="mono">{formatMoney(balanceDue, currency)}</strong>
          {paidSoFar > 0 && <span style={{ color: "var(--ink-faint)" }}> · paid so far {formatMoney(paidSoFar, currency)}</span>}
        </p>
        <div className="row2">
          <div className="fld"><label>Amount</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
          <div className="fld"><label>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="fld"><label>Reference (optional)</label><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction ID, cheque #, note" /></div>
        {over && (
          <div style={{ fontSize: ".8rem", color: "var(--red)", marginTop: ".2rem" }}>
            That's {formatMoney(amt - balanceDue, currency)} more than the balance due.
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!valid} onClick={() => onSave(amt, method, ref || undefined)}>Record payment</button>
        </div>
      </div>
    </div>
  );
}
