// Client-side PDF export with pdf-lib — local, zero server cost (Spec §9).
// Layout intentionally mirrors InvoicePreview so "preview = exact PDF" holds.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { PreviewData } from "../components/InvoicePreview";
import { formatMoney } from "./totals";
import { getTemplate, resolveAccent, ON_ACCENT } from "./templates";
import { qrDataUrl } from "./qr";
import { getLabels, formatDateFor, getLang } from "./i18n/labels";
import { pdfFontKind, PDF_FONTS, loadFontBytes } from "./i18n/pdfFonts";

const INK = rgb(0.12, 0.11, 0.09);
const INK2 = rgb(0.36, 0.33, 0.29);
const LINE = rgb(0.89, 0.86, 0.79);

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // margin

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function buildInvoicePdf(data: PreviewData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([A4.w, A4.h]);
  const tpl = getTemplate(data.template);
  const ACCENT = hexToRgb(resolveAccent(tpl, data.accentColor));
  const ON = hexToRgb(ON_ACCENT);

  // Auto-translate: pick fonts + labels for the target language. Vietnamese,
  // Thai and CJK need an embedded Noto font; if that asset isn't hosted yet we
  // fall back to an English PDF rather than rendering blank glyphs.
  let lang = getLang(data.lang);
  let locale = data.locale;
  let font!: PDFFont, bold!: PDFFont;
  const kind = pdfFontKind(lang);
  let embedded = false;
  if (kind !== "builtin") {
    pdf.registerFontkit(fontkit);
    const files = PDF_FONTS[kind];
    const regBytes = await loadFontBytes(files.regular);
    if (regBytes) {
      font = await pdf.embedFont(regBytes, { subset: true });
      const boldBytes = files.bold ? await loadFontBytes(files.bold) : null;
      bold = boldBytes ? await pdf.embedFont(boldBytes, { subset: true }) : font;
      embedded = true;
    }
  }
  if (!embedded) {
    if (kind !== "builtin") { lang = getLang("en"); locale = "en"; } // graceful: no font → English PDF
    const serif = tpl.font === "serif";
    font = await pdf.embedFont(serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
    bold = await pdf.embedFont(serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  }

  const L = embedded && data.labels ? data.labels : getLabels(lang.code);
  const money = (n: number) => formatMoney(n, data.currency, locale);
  const date = (iso?: string) => formatDateFor(iso, locale ?? "en");
  const up = (s: string) => s.toUpperCase(); // harmless for CJK/Thai (no case)
  // Sanitize user content: a no-op with an embedded Unicode font, but in the
  // Helvetica fallback (font asset missing) it strips non-WinAnsi chars so the
  // export can never throw "WinAnsi cannot encode …" on translated content.
  const t = embedded ? (s: string) => s : (s: string) => s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
  const docLabel = up(data.docType === "estimate" ? L.docEstimate : L.docInvoice);

  let y = A4.h - M;
  const right = A4.w - M;

  if (tpl.headerStyle === "band") {
    // accent strip across the top with logo + business (left) and INVOICE (right)
    const bandH = 96;
    page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: bandH, color: ACCENT });
    let bx = M;
    if (data.business?.logoDataUrl) {
      try {
        const img = await embedDataUrl(pdf, data.business.logoDataUrl);
        if (img) { const s = Math.min(110 / img.width, 40 / img.height, 1); page.drawImage(img, { x: M, y: A4.h - bandH / 2 - (img.height * s) / 2, width: img.width * s, height: img.height * s }); bx = M + img.width * s + 12; }
      } catch { /* ignore */ }
    }
    page.drawText(t(data.business?.name ?? "Your business"), { x: bx, y: A4.h - 46, size: 16, font: bold, color: ON });
    if (data.business?.email) page.drawText(t([data.business.email, data.currency].filter(Boolean).join("  ·  ")), { x: bx, y: A4.h - 62, size: 9, font, color: ON, opacity: 0.85 });
    page.drawText(docLabel, { x: right - bold.widthOfTextAtSize(docLabel, 20), y: A4.h - 46, size: 20, font: bold, color: ON });
    page.drawText(t(`#${data.number}`), { x: right - font.widthOfTextAtSize(t(`#${data.number}`), 10), y: A4.h - 62, size: 10, font, color: ON, opacity: 0.85 });
    y = A4.h - bandH - 24;
  } else {
    // plain / minimal header
    if (data.business?.logoDataUrl) {
      try {
        const img = await embedDataUrl(pdf, data.business.logoDataUrl);
        if (img) { const scale = Math.min(120 / img.width, 48 / img.height, 1); page.drawImage(img, { x: M, y: y - img.height * scale, width: img.width * scale, height: img.height * scale }); }
      } catch { /* ignore bad logo */ }
    }
    page.drawText(docLabel, { x: right - bold.widthOfTextAtSize(docLabel, 22), y: y - 18, size: 22, font: bold, color: tpl.headerStyle === "minimal" ? INK : ACCENT });
    page.drawText(t(data.number), { x: right - font.widthOfTextAtSize(t(data.number), 10), y: y - 34, size: 10, font, color: INK2 });

    y -= 62;
    y = drawLines(page, [t(data.business?.name ?? "Your business")], M, y, 12, bold, INK);
    if (data.business?.address) y = drawLines(page, t(data.business.address).split("\n"), M, y, 9, font, INK2);
    if (data.business?.email) y = drawLines(page, [t(data.business.email)], M, y, 9, font, INK2);
    if (data.business?.taxId) y = drawLines(page, [t(`Tax ID: ${data.business.taxId}`)], M, y, 9, font, INK2);

    hr(page, y - 6);
    y -= 22;
  }

  // bill to + dates
  const billTop = y;
  page.drawText(up(L.billedTo), { x: M, y, size: 8, font: bold, color: INK2 });
  let by = y - 14;
  by = drawLines(page, [t(data.client?.name ?? "—")], M, by, 10, bold, INK);
  if (data.client?.address) by = drawLines(page, t(data.client.address).split("\n"), M, by, 9, font, INK2);
  if (data.client?.email) by = drawLines(page, [t(data.client.email)], M, by, 9, font, INK2);

  const dLabel = (label: string, val: string, yy: number) => {
    const txt = `${label}  ${val}`;
    page.drawText(txt, { x: right - font.widthOfTextAtSize(txt, 9), y: yy, size: 9, font, color: INK });
  };
  dLabel(L.issued, date(data.issueDate), billTop - 14);
  if (data.dueDate) dLabel(L.due, date(data.dueDate), billTop - 28);

  y = Math.min(by, billTop - 34) - 16;

  // Pagination: long invoices continue on extra pages — the table header is
  // repeated, and totals/notes flow to wherever the lines end.
  const BOTTOM = M + 28;
  const newPage = () => { page = pdf.addPage([A4.w, A4.h]); y = A4.h - M; };
  const ensure = (needed: number) => { if (y - needed < BOTTOM) newPage(); };

  // line table header
  const cols = { desc: M, qty: 330, rate: 400, amount: right };
  const tableHeader = () => {
    page.drawText(up(L.description), { x: cols.desc, y, size: 8, font: bold, color: INK2 });
    rt(page, up(L.qty), cols.qty, y, 8, bold, INK2);
    rt(page, up(L.rate), cols.rate, y, 8, bold, INK2);
    rt(page, up(L.amount), cols.amount, y, 8, bold, INK2);
    y -= 6; hr(page, y); y -= 14;
  };
  tableHeader();

  for (const l of data.lines) {
    if (y - 22 < BOTTOM) { newPage(); tableHeader(); }
    page.drawText(t(trim(l.description || "—", 48)), { x: cols.desc, y, size: 9, font, color: INK });
    rt(page, String(l.qty), cols.qty, y, 9, font, INK);
    rt(page, money(l.rate), cols.rate, y, 9, font, INK);
    rt(page, money(l.amount), cols.amount, y, 9, font, INK);
    y -= 8; hr(page, y, LINE); y -= 14;
  }

  // totals — keep the whole block on one page
  ensure(132);
  y -= 6;
  const tx = right - 200;
  const totalRow = (label: string, val: string, b = false) => {
    const f = b ? bold : font;
    page.drawText(label, { x: tx, y, size: b ? 10 : 9, font: f, color: b ? INK : INK2 });
    rt(page, val, right, y, b ? 12 : 9, f, b ? ACCENT : INK);
    y -= b ? 18 : 15;
  };
  totalRow(L.subtotal, money(data.subtotal));
  if (data.discount > 0) totalRow(L.discount, `-${money(data.discount)}`);
  if (data.taxTotal > 0) totalRow(L.tax, money(data.taxTotal));
  // grand-total rule — confined to the totals column, with space above and below
  // so it never strikes through the (taller) Total text.
  y -= 6;
  page.drawLine({ start: { x: tx, y }, end: { x: right, y }, thickness: 1, color: INK });
  y -= 14;
  if (data.paid && data.paid > 0) {
    totalRow(L.total, money(data.total));
    totalRow(L.paid, `-${money(data.paid)}`);
    totalRow(L.balanceDue, money(Math.max(data.total - data.paid, 0)), true);
  } else {
    totalRow(data.docType === "estimate" ? L.total : L.totalDue, money(data.total), true);
  }

  // payment link (+ scannable QR) / notes / terms
  y -= 12;
  if (data.paymentLink) {
    ensure(110); // label + link + QR block
    page.drawText(L.payOnline, { x: M, y, size: 9, font: bold, color: ACCENT });
    y = drawLines(page, [t(data.paymentLink)], M, y - 12, 8, font, INK2);
    try {
      const qr = await embedDataUrl(pdf, await qrDataUrl(data.paymentLink, 220));
      if (qr) { const s = 64; page.drawImage(qr, { x: M, y: y - s - 2, width: s, height: s }); y -= s + 8; }
    } catch { /* QR is best-effort */ }
    y -= 6;
  }
  // long notes/terms flow across pages line by line
  const textBlock = (label: string, body: string) => {
    ensure(34);
    page.drawText(label, { x: M, y, size: 9, font: bold, color: INK });
    y -= 12;
    for (const line of wrap(t(body), 90)) {
      if (y < BOTTOM) newPage();
      page.drawText(line, { x: M, y, size: 8, font, color: INK2 });
      y -= 11;
    }
    y -= 6;
  };
  if (data.notes) textBlock(L.notes, data.notes);
  if (data.terms) textBlock(L.terms, data.terms);

  // page numbers, only when the invoice spans multiple pages
  const pages = pdf.getPages();
  if (pages.length > 1) {
    pages.forEach((p, i) => {
      const txt = `${i + 1} / ${pages.length}`;
      p.drawText(txt, { x: A4.w - M - font.widthOfTextAtSize(txt, 8), y: M - 20, size: 8, font, color: INK2 });
    });
  }

  return pdf.save();
}

export async function exportInvoicePdf(data: PreviewData): Promise<void> {
  const bytes = await buildInvoicePdf(data);
  // copy into a fresh ArrayBuffer-backed view so Blob's typing is satisfied
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.number || "invoice"}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---- helpers ---- */
function hr(page: PDFPage, y: number, color = LINE) {
  page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.75, color });
}
function rt(page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color = INK) {
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color });
}
function drawLines(page: PDFPage, arr: string[], x: number, y: number, size: number, font: PDFFont, color = INK): number {
  for (const line of arr) { page.drawText(line, { x, y, size, font, color }); y -= size + 3; }
  return y;
}
function trim(s: string, max: number) { return s.length > max ? s.slice(0, max - 1) + "…" : s; }
function wrap(s: string, max: number): string[] {
  const words = s.split(/\s+/); const out: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max) { out.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
async function embedDataUrl(pdf: PDFDocument, dataUrl: string) {
  const isPng = dataUrl.startsWith("data:image/png");
  const isJpg = /^data:image\/jpe?g/.test(dataUrl);
  if (!isPng && !isJpg) return null;
  const b64 = dataUrl.split(",")[1];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return isPng ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}
