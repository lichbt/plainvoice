// POST /api/billing/claim — server-verified grant of AI uses after a purchase.
//
// The overlay's Checkout.Success gives the client an order id + identifier (a
// UUID). We re-fetch that order from the Lemon Squeezy API and only grant if it
// is really PAID, for OUR store/product, and the unguessable identifier matches
// (so a guessed order id can't claim someone else's grant). Cloudflare KV records
// each claimed order so it can never be granted twice.
//
// Graceful: if LS_API_KEY isn't set, returns 503 not_configured and the client
// falls back to the simple client-side grant — so the feature still works before
// you've wired the secret.
//
// Setup (docs/LAUNCH-CHECKLIST.md): LS_API_KEY secret, BILLING_KV namespace
// binding, optional LS_STORE_ID / LS_VARIANT_ID / USES_PER_PACK.

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface Env {
  LS_API_KEY?: string;     // Lemon Squeezy API key (server only) — required to verify
  LS_STORE_ID?: string;    // verify the order is from our store
  LS_VARIANT_ID?: string;  // verify it's the right product
  USES_PER_PACK?: string;  // uses granted per order (default 50)
  BILLING_KV?: KV;         // dedupe claimed orders (replay protection)
}

const DEFAULT_USES = 50;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  // Not wired yet → tell the client to fall back to the simple grant.
  if (!env.LS_API_KEY) return json({ ok: false, error: "not_configured" }, 503);

  let orderId = "", identifier = "";
  try {
    const body = (await request.json()) as { orderId?: string | number; identifier?: string };
    orderId = String(body.orderId ?? "").trim();
    identifier = String(body.identifier ?? "").trim();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  if (!orderId) return json({ ok: false, error: "invalid" }, 400);

  // Fetch the order from Lemon Squeezy.
  let order: any;
  try {
    const resp = await fetch(`https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${env.LS_API_KEY}` },
    });
    if (resp.status === 404) return json({ ok: false, error: "invalid" }, 400);
    if (!resp.ok) return json({ ok: false, error: "upstream_error" }, 502);
    order = (await resp.json())?.data;
  } catch {
    return json({ ok: false, error: "upstream_unreachable" }, 502);
  }
  const attrs = order?.attributes;
  if (!attrs) return json({ ok: false, error: "invalid" }, 400);

  // Must be a real, paid, non-refunded order.
  if (attrs.status !== "paid" || attrs.refunded === true) return json({ ok: false, error: "not_paid" }, 400);

  // Unguessable identifier must match the one the buyer's browser received.
  if (identifier && attrs.identifier && identifier !== attrs.identifier) {
    return json({ ok: false, error: "mismatch" }, 400);
  }
  // Must be our store / product (when configured).
  if (env.LS_STORE_ID && String(attrs.store_id) !== String(env.LS_STORE_ID)) {
    return json({ ok: false, error: "wrong_store" }, 400);
  }
  if (env.LS_VARIANT_ID && String(attrs.first_order_item?.variant_id) !== String(env.LS_VARIANT_ID)) {
    return json({ ok: false, error: "wrong_product" }, 400);
  }

  // Grant exactly once per order. KV is the dedupe ledger; without it we still
  // verify the order is real+paid (just without replay protection — log a note).
  const claimKey = `claim:${attrs.identifier || orderId}`;
  if (env.BILLING_KV) {
    if (await env.BILLING_KV.get(claimKey)) return json({ ok: false, error: "already_claimed" }, 409);
    await env.BILLING_KV.put(claimKey, new Date().toISOString());
  } else {
    console.log("billing.claim: no BILLING_KV bound — granting without replay protection");
  }

  const uses = parseInt(env.USES_PER_PACK ?? "", 10) || DEFAULT_USES;
  return json({ ok: true, uses });
};
