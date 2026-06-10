import { useEffect, useState } from "react";
import { grantAiUses } from "../db/db";
import { BUY_USES_URL, USES_PER_PACK, PACK_PRICE } from "../lib/links";

// Buy more AI uses — no account, no key to paste. We open Lemon Squeezy's overlay
// checkout in-page; when the purchase succeeds the overlay fires Checkout.Success
// and we add the uses to the local counter. Lemon Squeezy handles tax/VAT + payout.
declare global {
  interface Window {
    LemonSqueezy?: { Setup: (o: { eventHandler: (e: { event: string }) => void }) => void; Url: { Open: (url: string) => void } };
    createLemonSqueezy?: () => void;
  }
}

// Load lemon.js once; resolve when window.LemonSqueezy is ready.
function ensureLemon(): Promise<Window["LemonSqueezy"]> {
  if (window.LemonSqueezy) return Promise.resolve(window.LemonSqueezy);
  return new Promise((resolve, reject) => {
    const ready = () => { window.createLemonSqueezy?.(); resolve(window.LemonSqueezy); };
    const existing = document.querySelector<HTMLScriptElement>("script[data-lemon]");
    if (existing) { existing.addEventListener("load", ready); existing.addEventListener("error", () => reject(new Error("load"))); return; }
    const s = document.createElement("script");
    s.src = "https://assets.lemonsqueezy.com/lemon.js";
    s.defer = true; s.dataset.lemon = "1";
    s.onload = ready; s.onerror = () => reject(new Error("load"));
    document.head.appendChild(s);
  });
}

// Force the overlay (?embed=1) so checkout opens in-page, not a new tab.
function embedUrl(url: string): string {
  return url.includes("embed=1") ? url : url + (url.includes("?") ? "&" : "?") + "embed=1";
}

export function BuyUsesModal({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  // Wire the overlay's success event to the local grant.
  useEffect(() => {
    let done = false;
    ensureLemon()
      .then((ls) => {
        ls?.Setup({
          eventHandler: (e) => {
            if (e.event === "Checkout.Success" && !done) {
              done = true;
              void grantAiUses(USES_PER_PACK).then(() => { setAdded(USES_PER_PACK); setBusy(false); });
            }
          },
        });
      })
      .catch(() => {/* opening will surface the error */});
  }, []);

  async function buy() {
    setError(null); setBusy(true);
    try {
      const ls = await ensureLemon();
      ls?.Url.Open(embedUrl(BUY_USES_URL));
      // busy stays true until Checkout.Success (or the user closes the overlay)
    } catch {
      setBusy(false);
      setError("Couldn't open checkout — check your connection and try again.");
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
            <p className="m-lead">You're all set — enjoy the AI features.</p>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <h3>More AI uses</h3>
            <p className="m-lead">
              Everything else in Plainvoice is free. AI features (chat-to-invoice, auto-translate) use one
              "use" each. Top up whenever you run low — one-time, no subscription, no account.
            </p>

            <div className="buy-pack">
              <div>
                <div className="buy-pack-n">{USES_PER_PACK} AI uses</div>
                <div className="buy-pack-sub">one-time · no expiry · added instantly</div>
              </div>
              <button className="btn btn-primary" onClick={buy} disabled={busy}>
                {busy ? "Opening…" : `Buy · ${PACK_PRICE}`}
              </button>
            </div>

            <p className="buy-foot">Secure checkout by Lemon Squeezy. Your uses are added the moment payment clears.</p>
            {error && <div className="ai-error">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
