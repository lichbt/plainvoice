# Launch checklist — do these before going live

Living list of placeholders and config that must be set for production.
Tick them off when shipping for real.

## Must-do before launch
- [x] **Real donate / tip URL** — set to `https://ko-fi.com/plainvoices` (Ko-fi,
      PayPal payout for Vietnam). Powers the "Leave a tip" button in the post-send
      donate prompt (Flow 4).

## When the AI layer (Phase 2) ships
- [ ] **OpenRouter API key** set as a Pages secret (`OPENROUTER_API_KEY`) — never in client.
- [ ] Default **text model** is `openai/gpt-oss-120b:free` (chat-to-invoice + translate).
      Override with the `AI_MODEL` var for a paid/stronger one.
- [ ] **Photo "Read with AI" uses a VISION model** (`AI_VISION_MODEL`, default
      `openai/gpt-4o-mini` — PAID, ~$0.001–0.005/photo since the free text model can't
      see images). Trivial vs the $0.10/use price, but it IS a real per-use cost. Override
      via the `AI_VISION_MODEL` var; the free OCR read stays free + on-device.
- [ ] Decide the **free AI allowance** (suggested: 3 / month, no account).
- [ ] Verify the **MoR provider onboards Vietnam-based sellers** with a Wise/Payoneer
      payout **before** writing billing code (spec §15 blocker).

## AI-uses purchase flow (Lemon Squeezy overlay + server-verified grant) — to go live
Buyer clicks **Buy** → Lemon Squeezy overlay opens in-page → on success the app
calls `/api/billing/claim`, which re-fetches the order from the Lemon Squeezy API,
confirms it's **paid / our product / matching identifier**, dedupes it in KV, and
returns the uses to grant. No accounts, no key to paste.
- [ ] Create a **Lemon Squeezy** account + store; confirm payout works for Vietnam (PayPal/Wise).
- [ ] Create a **one-time product** "50 AI uses · $5".
- [ ] Replace **`BUY_USES_URL`** in `src/lib/links.ts` with the product's checkout URL
      (Store → Products → Share). The app auto-appends `?embed=1` for the overlay.
- [ ] Confirm your **store domain is allowed** for the lemon.js overlay (LS settings).
- [ ] Set the **`LS_API_KEY`** Pages secret (LS → Settings → API). Required for the
      server to verify orders. Until it's set, the app falls back to a client-side grant.
- [ ] Bind a **KV namespace as `BILLING_KV`** (Pages → Settings → Functions → KV bindings).
      This is the "granted once" ledger — without it, replay protection is off.
- [ ] Optional Pages vars **`LS_STORE_ID`** / **`LS_VARIANT_ID`** (extra checks the order is
      ours) and **`USES_PER_PACK`** (default 50).
- [ ] Test with a real (or test-mode) purchase: Buy → pay → "50 AI uses added";
      a repeat claim of the same order returns "already added".
- [ ] Note: balances are still stored on-device (no account). A user who clears site data
      loses remaining uses — acceptable for v1; full account-bound balances are a later step.

## Nice-to-have polish (optional)
- [ ] Final **product name + logo** (working name "Plainvoice"; global find-replace).
- [ ] Replace the single SVG PWA icon with proper PNG icons (192/512, maskable) if needed.
