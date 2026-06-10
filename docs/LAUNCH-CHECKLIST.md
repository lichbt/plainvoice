# Launch checklist — do these before going live

Living list of placeholders and config that must be set for production.
Tick them off when shipping for real.

## Must-do before launch
- [ ] **Real donate / tip URL** — replace the placeholder in `src/lib/links.ts`
      (`DONATE_URL = "https://www.buymeacoffee.com/plainvoice"`) with your actual
      Buy Me a Coffee / Ko-fi / GitHub Sponsors page. Powers the "Leave a tip"
      button in the post-send donate prompt (Flow 4) and any footer link.

## When the AI layer (Phase 2) ships
- [ ] **OpenRouter API key** set as a Pages secret (`OPENROUTER_API_KEY`) — never in client.
- [ ] Default **model id** is `openai/gpt-oss-120b:free` (free, supports tool calling).
      Override per-deploy with the `AI_MODEL` secret if you want a paid/stronger one.
- [ ] Decide the **free AI allowance** (suggested: 3 / month, no account).
- [ ] Verify the **MoR provider onboards Vietnam-based sellers** with a Wise/Payoneer
      payout **before** writing billing code (spec §15 blocker).

## AI-uses purchase flow (Lemon Squeezy overlay) — to go live
Dead simple, no accounts/keys/DB: the buyer clicks **Buy**, Lemon Squeezy's overlay
checkout opens in-page, and on success the app adds the uses automatically.
- [ ] Create a **Lemon Squeezy** account + store; confirm payout works for Vietnam (PayPal/Wise).
- [ ] Create a **one-time product** "50 AI uses · $5".
- [ ] Replace **`BUY_USES_URL`** in `src/lib/links.ts` with the product's checkout URL
      (Store → Products → Share). The app auto-appends `?embed=1` for the overlay.
- [ ] In Lemon Squeezy → Settings → confirm the **store domain is allowed** for the overlay
      (the lemon.js overlay must be permitted on plainvoice.co / pages.dev).
- [ ] Test with a real (or test-mode) purchase: Buy → pay in the overlay → "50 AI uses added".
- [ ] No server secrets needed for this flow (no `LS_*` vars). Grant happens client-side on
      the overlay's success event.
- [ ] Note: balances are on-device (no account), and the grant is client-trusted — fine for
      v1 honest-user metering; revisit with a server-verified grant (webhook + KV) later.

## Nice-to-have polish (optional)
- [ ] Final **product name + logo** (working name "Plainvoice"; global find-replace).
- [ ] Replace the single SVG PWA icon with proper PNG icons (192/512, maskable) if needed.
