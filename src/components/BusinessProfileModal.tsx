import { useState } from "react";
import { useEscape } from "../lib/useEscape";
import { businesses } from "../db/repos";
import { db, ensureSettings } from "../db/db";
import type { Business } from "../db/types";
import { CURRENCIES } from "../lib/currencies";

// Captured just-in-time at first send (Spec §3.4) — no upfront onboarding wizard.
export function BusinessProfileModal({
  initial,
  defaultCurrency,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial?: Business;
  defaultCurrency: string;
  onClose: () => void;
  onSaved: (business: Business) => void;
  onDeleted?: (id: string) => void;
}) {
  useEscape(onClose);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [paymentLink, setPaymentLink] = useState(initial?.paymentLink ?? "");
  const [currency, setCurrency] = useState(initial?.defaultCurrency ?? defaultCurrency);
  const [logoDataUrl, setLogoDataUrl] = useState(initial?.logoDataUrl);
  const [saving, setSaving] = useState(false);

  function onLogo(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const rec = await businesses.save({
      id: initial?.id, name: name.trim(),
      email: email || undefined, address: address || undefined, taxId: taxId || undefined,
      paymentLink: paymentLink.trim() || undefined,
      defaultCurrency: currency, logoDataUrl,
    });
    const s = await ensureSettings();
    await db.settings.update("singleton", { activeBusinessId: s.activeBusinessId ?? rec.id });
    setSaving(false);
    onSaved(rec);
  }

  async function remove() {
    if (!initial) return;
    if (!confirm(`Delete "${initial.name}"? This can't be undone.`)) return;
    await businesses.remove(initial.id);
    const s = await ensureSettings();
    if (s.activeBusinessId === initial.id) {
      const next = (await businesses.all())[0];
      await db.settings.update("singleton", { activeBusinessId: next?.id });
    }
    onDeleted?.(initial.id);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>
        <h3>{initial ? "Edit company" : "Your company"}</h3>
        <p className="m-lead">Shown on the invoice. We only ask for what we need.</p>
        <div className="fld"><label>Business name</label><input aria-label="Business name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div className="row2">
          <div className="fld"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="fld"><label>Default currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="fld"><label>Address</label><textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="fld"><label>Tax ID</label><input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
        <div className="fld">
          <label>Payment link (your own Stripe / PayPal)</label>
          <input value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} placeholder="https://buy.stripe.com/…  or  paypal.me/you" />
          <div style={{ fontSize: ".72rem", color: "var(--ink-faint)", marginTop: ".3rem" }}>Shown as a “Pay online” link. We never touch the money — 0% fee.</div>
        </div>
        <div className="fld">
          <label>Logo</label>
          <div style={{ display: "flex", alignItems: "center", gap: ".8rem" }}>
            {logoDataUrl ? <img src={logoDataUrl} alt="" style={{ height: 40, maxWidth: 100, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 6 }} /> : null}
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0])} style={{ fontSize: ".82rem", border: "none", background: "none", padding: 0 }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginTop: "1rem" }}>
          {initial && onDeleted ? <button className="btn btn-danger btn-sm" onClick={remove}>Delete</button> : null}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!name.trim() || saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
