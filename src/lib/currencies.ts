// Small curated currency list for the picker. Multi-currency per invoice (Spec §5).
export const CURRENCIES = [
  "USD", "EUR", "GBP", "VND", "JPY", "AUD", "CAD", "SGD", "INR", "CNY",
  "KRW", "THB", "MYR", "PHP", "IDR", "CHF", "SEK", "NZD", "AED", "BRL",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];
