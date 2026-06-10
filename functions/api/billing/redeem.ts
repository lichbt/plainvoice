// POST /api/billing/redeem — redeem a Lemon Squeezy license key for AI uses.
//
// Why this shape: Plainvoice has no accounts and no database. Lemon Squeezy's
// license API enforces "activate once" server-side (set the product's
// activation limit to 1), so ACTIVATING a key is our exactly-once guarantee —
// a key can only ever grant uses a single time, no DB needed on our side.
//
// Flow: client posts the key → we activate it with Lemon Squeezy → if it
// activates AND belongs to our store/variant, we tell the client how many uses
// to grant. The client adds them to its local counter.
//
// Setup (see docs/LAUNCH-CHECKLIST.md):
//   · Lemon Squeezy product "50 AI uses" → enable license keys, activation limit 1
//   · Pages vars: LS_STORE_ID, LS_VARIANT_ID (to verify the key is ours),
//     USES_PER_PACK (optional, default 50)

interface Env {
  LS_STORE_ID?: string;   // our Lemon Squeezy store id (verify the key is ours)
  LS_VARIANT_ID?: string; // the "50 uses" variant id (verify the right product)
  USES_PER_PACK?: string; // uses granted per redeemed key (default 50)
}

const DEFAULT_USES = 50;
const ACTIVATE_URL = "https://api.lemonsqueezy.com/v1/licenses/activate";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  let key = "";
  try {
    const body = (await request.json()) as { key?: string };
    key = String(body.key ?? "").trim();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  if (key.length < 8) return json({ ok: false, error: "invalid" }, 400);

  // Activate the key. Lemon Squeezy enforces the activation limit, so a key that
  // was already redeemed will fail here — that's our double-spend guard.
  let data: any;
  try {
    const resp = await fetch(ACTIVATE_URL, {
      method: "POST",
      headers: { Accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ license_key: key, instance_name: "plainvoice" }),
    });
    data = await resp.json();
  } catch {
    return json({ ok: false, error: "upstream_unreachable" }, 502);
  }

  // Already used up / not activatable.
  if (!data?.activated) {
    const msg = String(data?.error ?? "").toLowerCase();
    if (msg.includes("activation limit")) return json({ ok: false, error: "already_redeemed" }, 409);
    return json({ ok: false, error: "invalid" }, 400);
  }

  // Verify the key belongs to OUR store + product (so a key from any other Lemon
  // Squeezy store can't be redeemed here). Skipped only if the ids aren't configured.
  const meta = data.meta ?? {};
  if (env.LS_STORE_ID && String(meta.store_id) !== String(env.LS_STORE_ID)) {
    return json({ ok: false, error: "wrong_store" }, 400);
  }
  if (env.LS_VARIANT_ID && String(meta.variant_id) !== String(env.LS_VARIANT_ID)) {
    return json({ ok: false, error: "wrong_product" }, 400);
  }

  const uses = parseInt(env.USES_PER_PACK ?? "", 10) || DEFAULT_USES;
  return json({ ok: true, uses });
};
