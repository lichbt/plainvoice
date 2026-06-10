// POST /api/ai/parse-invoice — chat-to-invoice (Phase 2, Flow 2).
// Takes a sentence, returns structured invoice line primitives via OpenRouter
// (OpenAI-compatible forced function calling). Key is server-side only.
//
// Hard rules honoured here:
//  · API key never leaves the server (env secret OPENROUTER_API_KEY).
//  · The model returns line PRIMITIVES only (qty, unit-rate) — never totals.
//    The client recomputes every amount in code.
//  · Graceful degrade: no key configured → 503 so the UI can say so.
//
// TODO (hardening, needs a KV binding): per-IP rate-limit + daily $ budget cap +
// token/cost log. Until then we cap input size and rely on the platform.

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface Env {
  OPENROUTER_API_KEY?: string;
  AI_MODEL?: string;
  AI_KV?: KV; // optional KV binding for rate-limit + daily budget cap (fail-open if absent)
}

const MAX_INPUT = 8000; // allow pasting a whole chat/email thread, not just a sentence
// Free OpenRouter model. MUST support tool/function calling (we force tool_choice
// below). Override per-deploy with the AI_MODEL secret if you want a paid/stronger one.
const DEFAULT_MODEL = "openai/gpt-oss-120b:free";
const IP_DAILY = 20; // max AI calls per IP per day
const GLOBAL_DAILY = 500; // hard daily ceiling across everyone (budget backstop)

// Coarse rate-limit + budget cap via KV. Fail-open when no KV binding is set so
// the feature still works before you create the namespace.
async function withinLimits(env: Env, ip: string): Promise<{ ok: boolean; reason?: string }> {
  if (!env.AI_KV) return { ok: true };
  const day = new Date().toISOString().slice(0, 10);
  const ipKey = `rl:${day}:${ip}`;
  const gKey = `budget:${day}`;
  const ipN = parseInt((await env.AI_KV.get(ipKey)) || "0", 10);
  if (ipN >= IP_DAILY) return { ok: false, reason: "rate_limited" };
  const gN = parseInt((await env.AI_KV.get(gKey)) || "0", 10);
  if (gN >= GLOBAL_DAILY) return { ok: false, reason: "daily_budget" };
  await env.AI_KV.put(ipKey, String(ipN + 1), { expirationTtl: 172800 });
  await env.AI_KV.put(gKey, String(gN + 1), { expirationTtl: 172800 });
  return { ok: true };
}

const SYSTEM = [
  "You convert a freelancer's notes — or a pasted client chat/email thread — into invoice line items.",
  "The input may be long and messy: greetings, scheduling, small talk, multiple messages.",
  "Ignore everything that isn't agreed billable work.",
  "Extract each billable item as quantity × unit-rate.",
  "Put the PER-UNIT price in `rate` — NEVER the multiplied line total.",
  "Examples: '3 hours at $120/hr' → qty 3, rate 120; '5 logos at $50 each' → qty 5, rate 50;",
  "'$500 setup fee' → qty 1, rate 500. If only a lump sum is given for an item, set qty 1 and rate that sum.",
  "If a price was negotiated or changed during the chat, use the FINAL agreed price.",
  "Merge duplicate mentions of the same item — never list one item twice.",
  "Do not invent items, do not compute sums or totals, do not add tax or discounts.",
  "If a client/customer is named, set clientName. If a payment term like 'net 30' or",
  "'due in 2 weeks' is stated, set dueInDays. Use the draft_invoice function only.",
].join(" ");

const TOOL = {
  type: "function",
  function: {
    name: "draft_invoice",
    description: "Return the structured invoice draft extracted from the user's text.",
    parameters: {
      type: "object",
      properties: {
        currency: { type: "string", description: "ISO 4217 code only if explicitly stated" },
        clientName: { type: "string", description: "the client/customer name if mentioned" },
        dueInDays: { type: "integer", description: "payment term in days if stated (e.g. net 30 -> 30)" },
        notes: { type: "string", description: "any non-line note the user wants on the invoice" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              qty: { type: "number" },
              rate: { type: "number", description: "unit price; never the line total" },
            },
            required: ["description", "rate"],
          },
        },
      },
      required: ["lines"],
    },
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.OPENROUTER_API_KEY) return json({ error: "ai_not_configured" }, 503);

  let text = "", knownClients: string[] = [], defaultCurrency: string | undefined;
  try {
    const body = (await request.json()) as { text?: string; knownClients?: string[]; defaultCurrency?: string };
    text = (body.text ?? "").trim();
    knownClients = Array.isArray(body.knownClients) ? body.knownClients.slice(0, 200) : [];
    defaultCurrency = body.defaultCurrency;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (text.length < 3) return json({ error: "empty" }, 400);
  if (text.length > MAX_INPUT) return json({ error: "too_long" }, 413);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const limit = await withinLimits(env, ip);
  if (!limit.ok) return json({ error: limit.reason }, 429);

  const userMsg =
    `Description: ${text}` +
    (knownClients.length ? `\n\nKnown clients (match exactly if one fits): ${knownClients.join(", ")}` : "") +
    (defaultCurrency ? `\n\nDefault currency if none stated: ${defaultCurrency}` : "");

  let resp: Response;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        "HTTP-Referer": "https://plainvoice.pages.dev",
        "X-Title": "Plainvoice",
      },
      body: JSON.stringify({
        model: env.AI_MODEL || DEFAULT_MODEL,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "draft_invoice" } },
        max_tokens: 2000, // room for many line items from a long paste
        temperature: 0.2,
      }),
    });
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }

  if (!resp.ok) return json({ error: "upstream_error", status: resp.status }, 502);

  let data: any;
  try { data = await resp.json(); } catch { return json({ error: "bad_upstream_json" }, 502); }

  // cost log (Hard Rule #5) — visible in `wrangler pages deployment tail`
  if (data?.usage) console.log("ai.parse-invoice usage", JSON.stringify(data.usage));

  const call = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!call) return json({ error: "no_tool_call" }, 502);

  let parsed: unknown;
  try { parsed = JSON.parse(call); } catch { return json({ error: "unparseable_tool_args" }, 502); }

  // Return the raw structured args; the client validates + maps + recomputes totals.
  return json({ draft: parsed });
};
