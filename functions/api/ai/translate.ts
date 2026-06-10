// POST /api/ai/translate — translate a batch of the user's FREE TEXT (line
// descriptions, notes, terms) into a target language. Labels are NOT sent here
// (they come from a static dictionary, client-side & free). This is the only
// part of auto-translate that costs an AI "use".
//
// Hard rules honoured:
//  · API key never leaves the server (env secret OPENROUTER_API_KEY).
//  · Returns translations 1:1 with the input array, same order, same length.
//  · Proper nouns / numbers / codes are preserved, not localized.
//  · Graceful degrade: no key configured → 503 so the UI can say so.

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface Env {
  OPENROUTER_API_KEY?: string;
  AI_MODEL?: string;
  AI_KV?: KV;
}

const MAX_ITEMS = 60;
const MAX_TOTAL_CHARS = 8000;
const DEFAULT_MODEL = "openai/gpt-oss-120b:free";
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

const LANG_NAMES: Record<string, string> = {
  es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian",
  nl: "Dutch", id: "Indonesian", vi: "Vietnamese", ja: "Japanese",
  zh: "Simplified Chinese", ko: "Korean", th: "Thai", en: "English",
};

function systemFor(langName: string): string {
  return [
    `You are a professional translator. Translate each input string into ${langName}.`,
    "These are line items, notes and terms from a freelancer's invoice.",
    "Return EXACTLY one translation per input, in the same order, same count.",
    "Preserve numbers, currency amounts, codes, URLs, emails and proper nouns",
    "(company and person names) unchanged. Keep it concise and natural for an invoice.",
    "Do not add or merge items. Use the translate function only.",
  ].join(" ");
}

const TOOL = {
  type: "function",
  function: {
    name: "translate",
    description: "Return the translated strings, 1:1 with the input order.",
    parameters: {
      type: "object",
      properties: {
        translations: {
          type: "array",
          items: { type: "string" },
          description: "one translated string per input, same order and count",
        },
      },
      required: ["translations"],
    },
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.OPENROUTER_API_KEY) return json({ error: "ai_not_configured" }, 503);

  let strings: string[] = [], targetLang = "";
  try {
    const body = (await request.json()) as { strings?: unknown; targetLang?: string };
    strings = Array.isArray(body.strings) ? body.strings.map((s) => String(s ?? "")) : [];
    targetLang = String(body.targetLang ?? "");
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const langName = LANG_NAMES[targetLang];
  if (!langName) return json({ error: "bad_language" }, 400);
  if (strings.length === 0) return json({ translations: [] }); // nothing to bill
  if (strings.length > MAX_ITEMS) return json({ error: "too_many" }, 413);
  if (strings.join("").length > MAX_TOTAL_CHARS) return json({ error: "too_long" }, 413);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const limit = await withinLimits(env, ip);
  if (!limit.ok) return json({ error: limit.reason }, 429);

  const userMsg = "Translate these invoice strings:\n" + JSON.stringify(strings);

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
        messages: [{ role: "system", content: systemFor(langName) }, { role: "user", content: userMsg }],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "translate" } },
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
  if (data?.usage) console.log("ai.translate usage", JSON.stringify(data.usage));

  const call = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!call) return json({ error: "no_tool_call" }, 502);

  let parsed: any;
  try { parsed = JSON.parse(call); } catch { return json({ error: "unparseable_tool_args" }, 502); }

  let out: string[] = Array.isArray(parsed?.translations) ? parsed.translations.map((s: unknown) => String(s ?? "")) : [];
  // Guard the 1:1 contract: pad with originals / trim overflow so the client can
  // always zip translations back onto its source array by index.
  if (out.length < strings.length) out = out.concat(strings.slice(out.length));
  else if (out.length > strings.length) out = out.slice(0, strings.length);

  return json({ translations: out });
};
