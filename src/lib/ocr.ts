// On-device OCR of a printed invoice photo (Spec §6) — free, runs in the browser
// via Tesseract.js. Best-effort parse into editable line items; the user confirms
// everything (Hard Rule #3: AI/extraction output is always an editable draft).
import Tesseract from "tesseract.js";

export interface OcrLine { description: string; qty: number; rate: number }
export interface OcrResult { lines: OcrLine[]; rawText: string }

// matches a trailing money amount like 1,234.56 / $90 / 2400.00
const AMOUNT_RE = /([$£€]?\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?|\d+\.\d{2})\s*$/;
const SKIP_RE = /\b(subtotal|sub-total|total|tax|vat|gst|balance|amount due|discount|invoice|date|due|paid)\b/i;

export async function recognizeInvoice(
  file: File | Blob,
  onProgress?: (pct: number) => void,
): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: (m) => { if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100)); },
  });
  return { lines: parseLines(data.text), rawText: data.text };
}

export function parseLines(text: string): OcrLine[] {
  const out: OcrLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 3 || SKIP_RE.test(line)) continue;
    const m = line.match(AMOUNT_RE);
    if (!m) continue;
    const rate = parseFloat(m[1].replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(rate) || rate === 0) continue;
    let description = line.slice(0, m.index).replace(/[.\s·:-]+$/, "").trim();
    // pull a leading "2 x" / "3 @" quantity if present
    let qty = 1;
    const q = description.match(/^(\d+)\s*[x@×]\s*/i);
    if (q) { qty = parseInt(q[1], 10) || 1; description = description.slice(q[0].length).trim(); }
    if (!description) description = "Item";
    out.push({ description, qty, rate });
  }
  return out;
}
