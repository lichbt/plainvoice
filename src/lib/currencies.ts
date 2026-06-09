// Small curated currency list for the picker. Multi-currency per invoice (Spec §5).
export const CURRENCIES = [
  "USD", "EUR", "GBP", "VND", "JPY", "AUD", "CAD", "SGD", "INR", "CNY",
  "KRW", "THB", "MYR", "PHP", "IDR", "CHF", "SEK", "NZD", "AED", "BRL",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

// region (ISO 3166) → currency, limited to the currencies we offer. Euro-zone → EUR.
const REGION_CCY: Record<string, string> = {
  US: "USD", GB: "GBP", VN: "VND", JP: "JPY", AU: "AUD", CA: "CAD", SG: "SGD",
  IN: "INR", CN: "CNY", KR: "KRW", TH: "THB", MY: "MYR", PH: "PHP", ID: "IDR",
  CH: "CHF", SE: "SEK", NZ: "NZD", AE: "AED", BR: "BRL",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR",
  AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
};

/** Best-guess currency from the browser locale (Flow 1 smart default). Falls back to USD. */
export function localeCurrency(): string {
  try {
    const loc = typeof navigator !== "undefined" ? navigator.language : "en-US";
    const localeObj = new Intl.Locale(loc) as Intl.Locale & { maximize?: () => Intl.Locale };
    const region: string | undefined = localeObj.maximize?.().region ?? loc.split("-")[1];
    const ccy = region ? REGION_CCY[region.toUpperCase()] : undefined;
    return ccy && (CURRENCIES as readonly string[]).includes(ccy) ? ccy : "USD";
  } catch {
    return "USD";
  }
}
