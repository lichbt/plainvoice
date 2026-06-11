// POST /api/ai/parse-invoice-image — read a PHOTO of an invoice with a vision
// model and return structured line primitives. The paid "Read with AI" path for
// photo import; reads the image directly (layout, messy receipts, handwriting),
// far better than on-device OCR.
//
// Uses a plain JSON-output prompt (NOT forced tool-calling) so it works with the
// free vision models on OpenRouter, which mostly don't support tools.
//
// Hard rules: key stays server-side · returns line PRIMITIVES only (qty, rate),
// never totals · 503 when no key so the UI falls back to the free OCR read.

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface Env {
  OPENROUTER_API_KEY?: string;
  AI_VISION_MODEL?: string;
  AI_KV?: KV;
}

// Vision needs a PAID model + OpenRouter credits (free vision models retired).
// NOTE: OpenAI *and* Google models are geo-restricted (403) in some regions incl.
// Vietnam. Open-weight models (Qwen/Mistral/Llama) are served by global providers
// and aren't region-locked. Qwen2.5-VL is strong at document/OCR extraction.
// Override with AI_VISION_MODEL.
const DEFAULT_VISION_MODEL = "qwen/qwen2.5-vl-72b-instruct";
const MAX_IMAGE_CHARS = 7_000_000;
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
  "Reply with ONLY a JSON object, no prose, no markdown fences, of this exact shape:",
  '{"currency": string optional, "clientName": string optional, "notes": string optional,',
  '"lines": [{"description": string, "qty": number, "rate": number}]}',
  "rate is the PER-UNIT price, never the line total. If a line shows only a total for",
  "several units, set qty=1 and rate=that amount. Ignore subtotals, tax, totals,",
  "balances, headers and addresses — line items only. Do not invent items or compute sums.",
].join(" ");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// pull a JSON object out of a model reply (may be wrapped in ```json fences / prose)
function extractJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
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

  try {
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
                { type: "text", text: `Extract the invoice line items from this photo as JSON. ${hint}` },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
          max_tokens: 1500,
          temperature: 0.1,
        }),
      });
    } catch (e) {
      console.log("vision.fetch_threw", String(e));
      return json({ error: "upstream_unreachable" }, 502);
    }

    const bodyText = await resp.text();
    if (!resp.ok) { console.log("vision.upstream_err", resp.status, bodyText.slice(0, 300)); return json({ error: "upstream_error", status: resp.status }, 502); }

    let data: any;
    try { data = JSON.parse(bodyText); } catch { return json({ error: "bad_upstream_json" }, 502); }
    if (data?.usage) console.log("ai.parse-image usage", JSON.stringify(data.usage));

    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content
      : Array.isArray(content) ? content.map((c: any) => c?.text ?? "").join("") : "";
    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.lines)) { console.log("vision.no_json", text.slice(0, 300)); return json({ error: "no_result" }, 502); }

    return json({ draft: parsed });
  } catch (e) {
    console.log("vision.handler_threw", String(e));
    return json({ error: "server_error" }, 500);
  }
};
