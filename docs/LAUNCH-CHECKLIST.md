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

## Nice-to-have polish (optional)
- [ ] Final **product name + logo** (working name "Plainvoice"; global find-replace).
- [ ] Replace the single SVG PWA icon with proper PNG icons (192/512, maskable) if needed.
