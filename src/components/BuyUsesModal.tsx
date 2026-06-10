import { useState } from "react";
import { grantAiUses } from "../db/db";
import { BUY_USES_URL, USES_PER_PACK, PACK_PRICE } from "../lib/links";

// Buy more AI uses. No account/login: you buy a pack on the Lemon Squeezy hosted
// checkout, get a license key, and paste it here. The server activates the key
// (one-time, enforced by Lemon Squeezy) and we add the uses to the local counter.
export function BuyUsesModal({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  const ERR: Record<string, string> = {
    invalid: "That key doesn't look right. Copy it exactly from your receipt email.",
    already_redeemed: "This key has already been used.",
    wrong_store: "That key isn't from Plainvoice.",
    wrong_product: "That key is for a different product.",
    upstream_unreachable: "Couldn't reach the billing service — try again in a moment.",
  };

  async function redeem() {
    const k = key.trim();
    if (k.length < 8 || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/billing/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: k }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; uses?: number; error?: string };
      if (!data.ok) { setError(ERR[data.error ?? ""] ?? "Couldn't redeem that key. Try again."); return; }
      const total = await grantAiUses(data.uses ?? USES_PER_PACK);
      setAdded(data.uses ?? USES_PER_PACK);
      void total;
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>

        {added !== null ? (
          <div className="buy-done">
            <div className="buy-done-tick">✓</div>
            <h3>{added} AI uses added</h3>
            <p className="m-lead">You're all set. Enjoy the AI features.</p>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <h3>More AI uses</h3>
            <p className="m-lead">
              Everything else in Plainvoice is free. AI features (chat-to-invoice, auto-translate) use one
              "use" each — top up whenever you run low. No subscription.
            </p>

            <div className="buy-pack">
              <div>
                <div className="buy-pack-n">{USES_PER_PACK} AI uses</div>
                <div className="buy-pack-sub">one-time · no expiry · no account</div>
              </div>
              <a className="btn btn-primary" href={BUY_USES_URL} target="_blank" rel="noopener">
                Buy · {PACK_PRICE}
              </a>
            </div>

            <div className="buy-sep"><span>then paste your key</span></div>

            <p className="m-lead" style={{ marginTop: 0 }}>
              After paying you'll get a license key by email and on the receipt page. Paste it here to add your uses.
            </p>
            <div className="buy-redeem">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") redeem(); }}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                aria-label="License key"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn btn-primary btn-sm" onClick={redeem} disabled={busy || key.trim().length < 8}>
                {busy ? "Checking…" : "Redeem"}
              </button>
            </div>
            {error && <div className="ai-error">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
