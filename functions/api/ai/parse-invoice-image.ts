// POST /api/ai/parse-invoice-image — read a PHOTO of an invoice with a vision
// model and return structured line primitives. This is the paid "Read with AI"
// path for photo import; it reads the image directly (handles layout, messy
// receipts, even handwriting) far better than on-device OCR.
//
// Hard rules honoured:
//  · API key never leaves the server (env secret OPENROUTER_API_KEY).
//  · Returns line PRIMITIVES only (qty, unit-rate) — never totals. Client recomputes.
//  · Graceful degrade: no key → 503 so the UI can fall back to the free OCR read.
//
// Privacy: unlike the OCR path, this DOES send the photo to the model. The client
// downscales it first and tells the user before sending.

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface Env {
  OPENROUTER_API_KEY?: string;
  AI_VISION_MODEL?: string;
  AI_KV?: KV;
}

const DEFAULT_VISION_MODEL = "openai/gpt-4o-mini"; // reliable vision + tool calling, cheap
const MAX_IMAGE_CHARS = 7_000_000; // ~5MB base64 — client downscales well below this
const IP_DAILY = 20;
const GLOBAL_DAILY = 500;

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
  "You read a photo of an invoice or receipt and extract its billable line items.",
  "Return each line as quantity × unit-rate. Put the PER-UNIT price in `rate`, never the line total.",
  "If a line shows only a total for several units, set qty=1 and rate=that amount.",
  "Ignore subtotals, tax, totals, balances, headers and addresses — line items only.",
  "Do not invent items or compute sums. If the client/customer name is visible, set clientName.",
  "If a currency symbol/code is visible, set currency. Use the draft_invoice function only.",
].join(" ");

const TOOL = {
  type: "function",
  function: {
    name: "draft_invoice",
    description: "Return the structured invoice draft extracted from the image.",
    parameters: {
      type: "object",
      properties: {
        currency: { type: "string", description: "ISO 4217 code only if visible" },
        clientName: { type: "string", description: "the client/customer name if visible" },
        notes: { type: "string", description: "any non-line note worth keeping" },
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

  let image = "", knownClients: string[] = [], defaultCurrency: string | undefined;
  try {
    const body = (await request.json()) as { image?: string; knownClients?: string[]; defaultCurrency?: string };
    image = String(body.image ?? "");
    knownClients = Array.isArray(body.knownClients) ? body.knownClients.slice(0, 200) : [];
    defaultCurrency = body.defaultCurrency;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!image.startsWith("data:image/")) return json({ error: "bad_image" }, 400);
  if (image.length > MAX_IMAGE_CHARS) return json({ error: "too_large" }, 413);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const limit = await withinLimits(env, ip);
  if (!limit.ok) return json({ error: limit.reason }, 429);

  const hint =
    (knownClients.length ? `Known clients (match exactly if one fits): ${knownClients.join(", ")}. ` : "") +
    (defaultCurrency ? `Default currency if none is visible: ${defaultCurrency}.` : "");

  let resp: Response;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        "HTTP-Referer": "https://plainvoices.com",
        "X-Title": "Plainvoice",
      },
      body: JSON.stringify({
        model: env.AI_VISION_MODEL || DEFAULT_VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract the invoice line items from this photo. ${hint}` },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "draft_invoice" } },
        max_tokens: 1500,
        temperature: 0.1,
      }),
    });
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }

  if (!resp.ok) return json({ error: "upstream_error", status: resp.status }, 502);

  let data: any;
  try { data = await resp.json(); } catch { return json({ error: "bad_upstream_json" }, 502); }
  if (data?.usage) console.log("ai.parse-image usage", JSON.stringify(data.usage));

  const call = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!call) return json({ error: "no_tool_call" }, 502);

  let parsed: unknown;
  try { parsed = JSON.parse(call); } catch { return json({ error: "unparseable_tool_args" }, 502); }

  return json({ draft: parsed });
};
