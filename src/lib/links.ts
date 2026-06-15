// Outbound links the user controls.
export const DONATE_URL = "https://ko-fi.com/plainvoices";

// Support address (Cloudflare Email Routing → forwards to the owner's inbox).
export const CONTACT_EMAIL = "hello@plainvoices.com";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

/** Open the Ko-fi tip page in a small centred popup over the app instead of
 *  navigating away. Ko-fi blocks true iframe embedding (X-Frame-Options), so a
 *  focused popup window is the closest "stay in the app" option. Falls back to a
 *  new tab if the popup is blocked. Must be called from a user gesture. */
export function openTipWindow(): void {
  if (typeof window === "undefined") return;
  const w = 450, h = 720;
  const left = Math.max(0, (window.screenX ?? 0) + ((window.outerWidth || w) - w) / 2);
  const top = Math.max(0, (window.screenY ?? 0) + ((window.outerHeight || h) - h) / 2);
  const popup = window.open(
    DONATE_URL,
    "kofi-tip",
    `popup=yes,width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)}`,
  );
  if (!popup) window.open(DONATE_URL, "_blank", "noopener"); // popup blocked → new tab
}

// Lemon Squeezy hosted checkout for the "50 AI uses · $5" pack. The app appends
// ?embed=1 so it opens as the in-page overlay.
export const BUY_USES_URL = "https://plainvoices.lemonsqueezy.com/checkout/buy/15adbdd0-b42a-4ae4-9885-c1d797521619";

export const USES_PER_PACK = 50;
export const PACK_PRICE = "$5";
