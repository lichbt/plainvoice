# Phase 2 — Flow 2 (value-first AI paywall), starting with Smart Collections

The free core stays 100% local-first and untouched. Phase 2 adds the **only** paid
surface: AI. This plan builds it incrementally so real value ships before any
billing exists. First feature: **Smart Collections** (draft an overdue-invoice reminder).

## Hard rules (from the build spec — non-negotiable)
1. Free core works fully with AI **off**. No core path checks Pro.
2. Recompute every money total **in code** — never trust LLM arithmetic. The reminder
   only *references* amounts we pass in; it never computes them.
3. AI output is always an **editable draft**; human confirms before send.
4. LLM/API keys **server-side only**. Rate-limit + budget-check before each call.
5. Log token cost per AI action from day one.
6. Value/preview **always** shown before any pay ask. Never paywall make/view/export/send.
7. Idempotent billing webhooks (dedupe on external id).

---

## Architecture (what gets added)

```
 static client (today)            NEW backend                  NEW externals
 ───────────────────             ───────────                  ─────────────
 Astro + React (Pages)  ──POST──▶ Cloudflare Pages Function ──▶ OpenRouter (OpenAI-compatible)
 local IndexedDB                  /functions/api/ai/reminder      → Claude Haiku (or any model)
 free-tier credit counter         · IP rate-limit (KV)            key = OPENROUTER_API_KEY (secret)
   (localStorage)                 · daily $ budget cap (KV)
                                  · token/cost log (KV or D1)
                        (phase 2b) /functions/api/auth/*  ──────▶ email (Resend) magic-link
                        (phase 2c) /functions/api/billing/webhook ◀─ MoR (Lemon Squeezy/Polar)
```

**Backend host:** Cloudflare **Pages Functions** (a `functions/` dir in this repo).
Chosen over a separate Worker because it's same-origin (no CORS, and auth cookies
"just work" in 2b) and deploys with the existing `npm run deploy`. Trade-off: it
couples to the Pages project; acceptable here.

> Build wiring note: Pages Functions must be included in the uploaded directory.
> Today we deploy `dist/`. We'll either (a) move to `wrangler pages deploy` with a
> `functions/` dir at repo root (Pages compiles it), or (b) keep Astro static and add
> an `_worker.js`/adapter. Confirm during 2a — it's a 30-min spike, not a rewrite.

---

## Sub-phase 2a — Smart Collections, value-first, NO auth/billing

Ships a real, useful AI feature gated only by a **free monthly allowance** (e.g. 3).
No account, no payment. This is the smallest slice that proves the value + economics.

### Backend: `functions/api/ai/reminder.ts`
- Input (JSON, no secrets): `{ invoiceNumber, amount, currency, dueDate, daysOverdue, clientName, businessName, tone }`.
- Before calling Claude:
  - **IP rate-limit** via KV (e.g. 10/day/IP) — stops a no-account user draining budget.
  - **Global daily budget cap** via KV (e.g. stop at $X/day) — hard ceiling.
- Call **OpenRouter** (`POST https://openrouter.ai/api/v1/chat/completions`, OpenAI-compatible,
  `Authorization: Bearer ${OPENROUTER_API_KEY}`, model e.g. `anthropic/claude-3.5-haiku`) with
  a tight template + slot-fill prompt, `max_tokens` small. OpenRouter lets us swap models
  later without code changes.
- **Log** `{in,out}` tokens + computed cost to KV/D1 (Hard Rule #5).
- Return `{ text }`. On budget/limit hit → `429` with a friendly reason.

### Client: the Chase flow (Flow 5 step 4 → Flow 2)
- Overdue invoice rows get a **"Chase"** action (list + editor).
- Chase opens a modal: **tone tabs** Friendly / Firm / Final.
- Calls `/api/ai/reminder` → shows the **drafted reminder first** (value before ask),
  editable textarea.
- Buttons: **Copy** · **Send** (reuse Flow 4 share-sheet/mailto). Recompute amounts in code.
- **Free allowance** metered locally: `settings.aiCreditsUsedThisMonth` + month key, reset
  monthly. When exhausted → show the upgrade choices UI (2c), which in 2a is a
  **"Pro coming soon"** placeholder (honest — no fake checkout).
- AI entry points render with a visible **"Pro"/"AI" pill**, never hidden.

### Cost control
- Haiku only. Template prompt. `max_tokens ≈ 220`. Cache identical (invoice,tone) within a
  session. Per-call cost ≈ fractions of a cent. Budget cap is the backstop.

### Deliverable 2a: a working "Chase → drafted reminder → edit → send", free up to N/month.

---

## Sub-phase 2b — Passwordless account (magic-link)

Needed so credits/Pro can attach to a *person*, not a device.
- `functions/api/auth/request` → email a signed magic link (Resend; verified DKIM domain).
- `functions/api/auth/callback` → set an httpOnly session cookie (signed JWT).
- `functions/api/auth/me` → returns `{ email, plan, creditsRemaining }`.
- Client: "Save & track? Enter email → click link." **No password fields, ever.**
- Move credit metering server-side (D1 ledger keyed to account); local counter becomes a
  cache. Account is still **optional** — free tier works without it.

---

## Sub-phase 2c — Billing (the full Flow 2 paywall)

- **MoR provider** (Merchant of Record handles tax/VAT + the Vietnam entity problem):
  Lemon Squeezy / Polar / Paddle. **BLOCKER to verify first (spec §15):** confirm the
  provider onboards **Vietnam-based sellers** with a usable payout (Wise/Payoneer)
  *before* writing billing code.
- Products: **Pro $9/mo** (unlimited AI within fair use) and **credit packs** (e.g. 20/$5).
- Flow: allowance exhausted → after showing the preview, present **Use 1 credit / Buy
  credits / Go Pro**. → MoR **hosted checkout** (card handled by MoR, never in-app) →
  on return refresh `/api/auth/me` → entitlement live → the pending AI action completes.
- `functions/api/billing/webhook` → **idempotent** (dedupe on external id) → flip plan /
  top up credits in D1.

---

## Build sequence & rough effort

| Step | What | Needs from you | Effort |
|---|---|---|---|
| 2a.0 | Pages Functions build spike | — | ~0.5 day |
| 2a.1 | `/api/ai/reminder` + KV rate-limit + budget + cost log | **OpenRouter API key** (placeholder; you set `wrangler pages secret put OPENROUTER_API_KEY`) | ~1 day |
| 2a.2 | Chase modal (tones, value-first draft, edit, send) + local allowance + Pro pill | free-allowance number | ~1–1.5 days |
| 2b | Magic-link auth + D1 credit ledger | email domain (Resend) | ~2 days |
| 2c | MoR checkout + webhook + entitlement | **MoR account** (verify VN payout first) + pricing | ~2–3 days |

**Recommendation:** build **2a only** first and live with it for a while. It delivers the
"get paid" value, instruments real token cost, and proves whether anyone would pay —
*before* you invest in auth + billing.

## Decisions needed before 2a
1. Confirm **Cloudflare Pages Functions** as the backend (vs a standalone Worker).
2. **OpenRouter API key** (placeholder) — you create it and set it as a Pages secret
   `OPENROUTER_API_KEY` (I never handle it). OpenRouter is OpenAI-compatible and routes to
   many models, so swapping Claude ↔ another is a config change, not code.
3. **Free allowance** number (suggest 3 Smart-Collections drafts / month, no account).
4. Default **model** id (e.g. `anthropic/claude-3.5-haiku`) — changeable anytime via OpenRouter.

## Decisions deferred to 2c
- MoR provider (after confirming VN onboarding + payout).
- Pricing: Pro $9/mo + credit pack size/price.
