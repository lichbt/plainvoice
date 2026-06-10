// Client-side glue for auto-translate. The labels are handled by the static
// dictionary (labels.ts); THIS module deals only with the user's free text
// (line descriptions, notes, terms) — collecting it, sending the batch to the
// AI endpoint, zipping the result back, and caching by language so re-viewing a
// language never costs another "use".

export interface TranslatableContent {
  lineDescriptions: string[]; // aligned 1:1 with the invoice's lines
  notes?: string;
  terms?: string;
}

export type TranslatedContent = TranslatableContent;

interface Slot {
  set: (out: TranslatableContent, value: string) => void;
  text: string;
}

// Build the ordered list of non-empty strings to translate + how to put each
// back. Empty fields are skipped (nothing to bill) but line indices are kept.
function plan(content: TranslatableContent): { strings: string[]; slots: Slot[] } {
  const slots: Slot[] = [];
  content.lineDescriptions.forEach((d, i) => {
    if (d && d.trim()) slots.push({ text: d, set: (o, v) => { o.lineDescriptions[i] = v; } });
  });
  if (content.notes && content.notes.trim()) slots.push({ text: content.notes, set: (o, v) => { o.notes = v; } });
  if (content.terms && content.terms.trim()) slots.push({ text: content.terms, set: (o, v) => { o.terms = v; } });
  return { strings: slots.map((s) => s.text), slots };
}

/** Stable signature of the source content; a change invalidates a cached lang. */
export function contentSignature(content: TranslatableContent): string {
  return JSON.stringify([content.lineDescriptions, content.notes ?? "", content.terms ?? ""]);
}

/** True if there is any free text worth translating (else it's all labels/numbers). */
export function hasTranslatableText(content: TranslatableContent): boolean {
  return plan(content).strings.length > 0;
}

/** Zip a flat translations array back onto the content shape (pure, testable). */
export function applyTranslations(content: TranslatableContent, translations: string[]): TranslatedContent {
  const { slots } = plan(content);
  const out: TranslatableContent = {
    lineDescriptions: [...content.lineDescriptions],
    notes: content.notes,
    terms: content.terms,
  };
  slots.forEach((slot, i) => { if (translations[i] != null) slot.set(out, translations[i]); });
  return out;
}

export interface TranslateResult {
  content: TranslatedContent;
  billed: boolean; // true only when the AI was actually called (cache miss)
  error?: "ai_not_configured" | "rate_limited" | "daily_budget" | "failed";
}

// Cache shape stored on the invoice: per-language translated content + the
// source signature it was produced from.
export interface CachedTranslation {
  sig: string;
  content: TranslatedContent;
}

/**
 * Translate (or return cached) content for a language.
 * - en (source) → returns content unchanged, never billed.
 * - cache hit (same signature) → returns cached, never billed.
 * - no free text → returns content unchanged, never billed.
 * - otherwise → calls the endpoint; billed=true on success.
 */
export async function translateContent(
  content: TranslatableContent,
  targetLang: string,
  cached: CachedTranslation | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<TranslateResult> {
  if (targetLang === "en") return { content, billed: false };

  const sig = contentSignature(content);
  if (cached && cached.sig === sig) return { content: cached.content, billed: false };

  const { strings } = plan(content);
  if (strings.length === 0) return { content, billed: false }; // only labels/numbers

  let resp: Response;
  try {
    resp = await fetchFn("/api/ai/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ strings, targetLang }),
    });
  } catch {
    return { content, billed: false, error: "failed" };
  }

  if (resp.status === 503) return { content, billed: false, error: "ai_not_configured" };
  if (resp.status === 429) {
    let reason = "rate_limited";
    try { reason = (await resp.json())?.error ?? reason; } catch { /* ignore */ }
    return { content, billed: false, error: reason === "daily_budget" ? "daily_budget" : "rate_limited" };
  }
  if (!resp.ok) return { content, billed: false, error: "failed" };

  let translations: string[] = [];
  try { translations = (await resp.json())?.translations ?? []; } catch { return { content, billed: false, error: "failed" }; }

  return { content: applyTranslations(content, translations), billed: true };
}
