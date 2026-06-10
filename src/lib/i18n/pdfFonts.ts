// PDF font selection for auto-translate. pdf-lib's built-in Helvetica/Times
// only encode WinAnsi (Latin-1-ish) — fine for English + most European
// languages, but NOT Vietnamese diacritics, Thai, or CJK. For those we embed a
// Noto font (subset on export so output PDFs stay small).
//
// The font binaries live under /fonts (public/fonts). If one is missing, the
// caller falls back to an English PDF rather than crashing — so the feature
// degrades gracefully until the assets are hosted.
import type { Lang } from "./labels";

export type PdfFontKind = "builtin" | "latinx" | "thai" | "cjk";

export interface ScriptFontFiles {
  regular: string;
  bold?: string; // optional; reuse regular when absent
}

// Expected asset paths. Keep filenames in sync with public/fonts/.
export const PDF_FONTS: Record<Exclude<PdfFontKind, "builtin">, ScriptFontFiles> = {
  latinx: { regular: "/fonts/NotoSans-Regular.ttf", bold: "/fonts/NotoSans-Bold.ttf" },
  thai: { regular: "/fonts/NotoSansThai-Regular.ttf", bold: "/fonts/NotoSansThai-Bold.ttf" },
  cjk: { regular: "/fonts/NotoSansCJK-Regular.ttf" }, // one face; bold reuses regular
};

/** Which font a language needs in the PDF. */
export function pdfFontKind(lang: Lang): PdfFontKind {
  if (lang.script === "cjk") return "cjk";
  if (lang.script === "thai") return "thai";
  if (lang.code === "vi") return "latinx"; // Latin but with diacritics Helvetica lacks
  return "builtin";
}

const cache = new Map<string, ArrayBuffer | null>();

/** Fetch + cache a font binary. Returns null if it isn't hosted (graceful). */
export async function loadFontBytes(url: string, fetchFn: typeof fetch = fetch): Promise<ArrayBuffer | null> {
  if (cache.has(url)) return cache.get(url)!;
  let bytes: ArrayBuffer | null = null;
  try {
    const r = await fetchFn(url);
    if (r.ok) bytes = await r.arrayBuffer();
  } catch {
    bytes = null;
  }
  cache.set(url, bytes);
  return bytes;
}
