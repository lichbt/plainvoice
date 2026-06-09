# Phase 2 — Chat-to-invoice (first AI feature)

Type a sentence → an **editable invoice draft**. The "wow" on first use, and the
easiest AI value to demo. Shares the Phase-2 backend/auth/billing scaffold described in
`PHASE2-FLOW2-PLAN.md` (Pages Function + Claude, then magic-link auth, then MoR billing).
This doc covers only the **feature-specific** parts.

> Example input: *"design work 8h at $150, logo $200, and 2 rounds of revisions at $90 for Acme Studios, due in 30 days"*
> Output: 3 editable line items, client "Acme Studios", Net-30 due date — all editable, totals computed in code.

## Hard rules that bite this feature hardest
- **Never trust the model's math.** The AI returns *line primitives* (description, qty,
  rate) only. App code recomputes every amount/subtotal/tax/total (the existing
  `computeTotals`). The model must NOT return computed totals — and if it does, we ignore them.
- **Always an editable draft.** Parsed output lands in the normal editor line state; the
  user reviews/edits before anything is saved or sent.
- **Value before ask.** The parsed draft appears first; the credit/paywall ask only after.
- **Key server-side, cost logged, free allowance** — same as the shared plan.

---

## The flow (entry → draft)

1. **Entry points**
   - Editor: a "✨ Describe this invoice" input/button above the line items.
   - Landing: a one-line "Type what you did → get an invoice" demo CTA → `/new?ai=1`.
   - (Later) the AI panel on the marketing page links here.
2. User types free text → **Send to AI** (shows a small "drafting…" state).
3. Client POSTs the text + minimal context to `POST /api/ai/parse-invoice`.
4. Backend calls Claude with **forced structured output** (tool-use / JSON schema) →
   returns strict JSON.
5. Client **validates** the JSON against a local schema, **maps** it into editor state
   (lines, optional client match, optional due-date/currency hints), then
   **recomputes totals in code**.
6. The editor now shows a populated, **editable** draft — value delivered. User tweaks,
   then saves/sends as normal.
7. **Free allowance** metered locally (e.g. 3 parses/month, no account). Exhausted →
   value already shown, then the upgrade choices (placeholder in 2a).

---

## Backend: `functions/api/ai/parse-invoice.ts`

- **Input** (JSON, no secrets): `{ text, knownClients?: string[], defaultCurrency? }`.
  `knownClients` lets the model match an existing client by name (we resolve the id
  client-side; the server never sees the client DB).
- **Guardrails before the call:** IP rate-limit (KV) + daily global budget cap (KV).
- **Model:** Claude **Haiku** with **tool-use forcing** a single structured result. The
  tool schema (the model MUST fill exactly this — no prose, no totals):

  ```jsonc
  {
    "name": "draft_invoice",
    "input_schema": {
      "type": "object",
      "properties": {
        "currency": { "type": "string", "description": "ISO 4217 if stated, else omit" },
        "clientName": { "type": "string", "description": "if a client/customer is named" },
        "dueInDays": { "type": "integer", "description": "if a term like 'net 30' / 'due in 2 weeks' is stated" },
        "notes": { "type": "string" },
        "lines": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "description": { "type": "string" },
              "qty": { "type": "number", "default": 1 },
              "rate": { "type": "number", "description": "unit price; NEVER the line total" }
            },
            "required": ["description", "rate"]
          }
        }
      },
      "required": ["lines"]
    }
  }
  ```

- **System prompt rules:** "Extract billable line items as qty × unit-rate. Put the
  *per-unit* price in `rate`, never the multiplied total. If only a total is given for a
  multi-unit item, set qty 1 and rate = that amount. Don't invent items. Don't compute
  sums." Cap `max_tokens` (~400). Log `{in,out}` tokens + cost.
- **Output:** the validated tool input `{ currency?, clientName?, dueInDays?, notes?, lines[] }`.
- On budget/limit hit → `429` with a friendly reason.

---

## Client: parse → validate → map (`src/lib/aiInvoice.ts`)

- **Validate** the response with a tiny guard (shape + numeric coercion). Drop malformed
  lines rather than trusting them. This is unit-testable (pure) — add tests like the
  OCR/CSV parsers.
- **Map** into the editor:
  - `lines` → the editor's `LineState[]` (same shape the photo-OCR import already produces;
    reuse the "replace if empty, else append" logic).
  - `clientName` → fuzzy-match against existing clients; exact/strong match selects it,
    otherwise leave a suggestion to "add as new client" (one tap).
  - `dueInDays` → set due date = issue + N (reuses the Net-14 helper).
  - `currency` → only if in our list; else keep current/locale default.
- **Recompute** with `computeTotals` (Hard Rule #2). The preview updates live.
- Everything lands in the **normal editable editor** — no separate "AI result" screen.

### Why this is low-risk
It reuses machinery that already exists and is tested: the line-item state, the
"populate from import" path (photo OCR), `computeTotals`, the client picker, the Net-14
helper. The only new surface is the input box + the parse/validate/map lib + the endpoint.

---

## UX details
- A compact text input ("e.g. *2h consulting at $120 and a $500 setup fee*") + a primary
  "Draft it ✨" button, carrying an **AI** pill.
- Disabled/empty input → no call. Trim; ignore very short input.
- "Drafting…" inline state; on error (429/network) a calm message ("Couldn't draft that —
  add lines by hand, or try again").
- After a successful draft, the input collapses; the user is in the normal editor.
- Respect `prefers-reduced-motion`.

## Cost control
- Haiku, structured tool-use, `max_tokens ≈ 400`, short inputs → ≈ fractions of a cent per
  parse. KV daily budget cap is the hard backstop. Cache identical input within a session.

---

## Build sequence & rough effort (2a slice only — no auth/billing)

| Step | What | Needs from you | Effort |
|---|---|---|---|
| 0 | Pages Functions build spike (shared) | — | ~0.5 day |
| 1 | `/api/ai/parse-invoice` (tool-use schema, rate-limit, budget, cost log) | **Anthropic API key** (you set as a Pages secret) | ~1 day |
| 2 | `aiInvoice.ts` validate+map + unit tests | — | ~0.5 day |
| 3 | Editor "Describe it" input + AI pill + draft state + free local allowance | free-allowance number | ~1 day |
| 4 | Landing `/new?ai=1` entry + E2E (mock the endpoint) | — | ~0.5 day |

≈ **3–3.5 days** for a working, value-first chat-to-invoice with a free monthly allowance.
Auth (2b) + billing (2c) come later, exactly as in the shared plan — build this and live
with it first.

## Decisions needed before building
1. Confirm **Cloudflare Pages Functions** as the backend (vs standalone Worker).
2. **Anthropic API key** — you create it and set it as a Pages secret (I never handle it).
3. **Free allowance** number (suggest 3 drafts / month, no account).
4. **Structured output** approach: Claude **tool-use** (recommended, most reliable) vs
   JSON-mode prompting.

## Testing strategy
- **Unit:** `aiInvoice.ts` validate/map — malformed JSON, total-vs-rate confusion, missing
  qty, currency/dueInDays parsing. (Pure, fast — like the existing 25.)
- **E2E:** stub `/api/ai/parse-invoice` to return canned JSON → assert the editor populates
  the right lines + totals. No real API call in CI (deterministic, free).
