// Static invoice-label dictionary — the FREE, instant, accurate half of
// auto-translate. These are fixed UI terms (Invoice, Subtotal, Due…), so they
// never go through the AI. Only the user's free text (line descriptions, notes,
// terms) is AI-translated. Numbers/dates/currency are locale-formatted via Intl.
//
// Keep this list in sync with InvoicePreview.tsx and pdf.ts (the two surfaces
// that render an invoice). English is the source of truth + the fallback.

export type LabelKey =
  | "docInvoice" | "docEstimate"
  | "issued" | "due" | "billedTo" | "status"
  | "description" | "qty" | "rate" | "amount"
  | "subtotal" | "tax" | "discount" | "shipping" | "total" | "totalDue" | "paid" | "balanceDue" | "po"
  | "payOnline" | "notes" | "terms" | "noLines"
  | "st_draft" | "st_sent" | "st_viewed" | "st_paid" | "st_overdue" | "st_accepted" | "st_declined";

export type LangScript = "latin" | "cjk" | "thai";

export interface Lang {
  code: string; // our short key, also the AI target-language hint
  name: string; // endonym, shown in the picker
  locale: string; // BCP-47 for Intl number/date formatting
  script: LangScript; // drives PDF font choice (latin = built-in, else embed)
}

// Source language first; the rest are translation targets.
export const LANGS: Lang[] = [
  { code: "en", name: "English", locale: "en", script: "latin" },
  { code: "es", name: "Español", locale: "es", script: "latin" },
  { code: "fr", name: "Français", locale: "fr", script: "latin" },
  { code: "de", name: "Deutsch", locale: "de", script: "latin" },
  { code: "pt", name: "Português", locale: "pt-PT", script: "latin" },
  { code: "it", name: "Italiano", locale: "it", script: "latin" },
  { code: "nl", name: "Nederlands", locale: "nl", script: "latin" },
  { code: "id", name: "Bahasa Indonesia", locale: "id", script: "latin" },
  { code: "vi", name: "Tiếng Việt", locale: "vi", script: "latin" },
  { code: "ja", name: "日本語", locale: "ja", script: "cjk" },
  { code: "zh", name: "中文", locale: "zh-CN", script: "cjk" },
  { code: "ko", name: "한국어", locale: "ko", script: "cjk" },
  { code: "th", name: "ไทย", locale: "th", script: "thai" },
];

export const DEFAULT_LANG = "en";

const LANG_BY_CODE = new Map(LANGS.map((l) => [l.code, l]));
export function getLang(code: string | undefined): Lang {
  return (code && LANG_BY_CODE.get(code)) || LANGS[0];
}

// English source / fallback. Every other map only needs to override; missing
// keys fall back to English so a partial translation never renders blank.
const EN: Record<LabelKey, string> = {
  docInvoice: "Invoice", docEstimate: "Estimate",
  issued: "Issued", due: "Due", billedTo: "Billed to", status: "Status",
  description: "Description", qty: "Qty", rate: "Rate", amount: "Amount",
  subtotal: "Subtotal", tax: "Tax", discount: "Discount", total: "Total",
  totalDue: "Total due", paid: "Paid", balanceDue: "Balance due",
  payOnline: "Pay online", notes: "Notes", terms: "Terms", noLines: "No line items yet",
  st_draft: "Draft", st_sent: "Sent", st_viewed: "Viewed", st_paid: "Paid",
  st_overdue: "Overdue", st_accepted: "Accepted", st_declined: "Declined",
    po: "PO number", shipping: "Shipping",
};

type Partial = { [K in LabelKey]?: string };

const DICT: Record<string, Partial> = {
  en: EN,
  es: {
    docInvoice: "Factura", docEstimate: "Presupuesto",
    issued: "Emitida", due: "Vence", billedTo: "Facturar a", status: "Estado",
    description: "Descripción", qty: "Cant.", rate: "Precio", amount: "Importe",
    subtotal: "Subtotal", tax: "Impuesto", discount: "Descuento", total: "Total",
    totalDue: "Total a pagar", paid: "Pagado", balanceDue: "Saldo pendiente",
    payOnline: "Pagar en línea", notes: "Notas", terms: "Condiciones", noLines: "Sin líneas todavía",
    st_draft: "Borrador", st_sent: "Enviada", st_viewed: "Vista", st_paid: "Pagada",
    st_overdue: "Vencida", st_accepted: "Aceptado", st_declined: "Rechazado",
    po: "Nº de pedido", shipping: "Envío",
  },
  fr: {
    docInvoice: "Facture", docEstimate: "Devis",
    issued: "Émise", due: "Échéance", billedTo: "Facturé à", status: "Statut",
    description: "Description", qty: "Qté", rate: "Tarif", amount: "Montant",
    subtotal: "Sous-total", tax: "TVA", discount: "Remise", total: "Total",
    totalDue: "Total à payer", paid: "Payé", balanceDue: "Solde dû",
    payOnline: "Payer en ligne", notes: "Notes", terms: "Conditions", noLines: "Aucune ligne pour l’instant",
    st_draft: "Brouillon", st_sent: "Envoyée", st_viewed: "Vue", st_paid: "Payée",
    st_overdue: "En retard", st_accepted: "Accepté", st_declined: "Refusé",
    po: "N° de commande", shipping: "Livraison",
  },
  de: {
    docInvoice: "Rechnung", docEstimate: "Angebot",
    issued: "Ausgestellt", due: "Fällig", billedTo: "Rechnung an", status: "Status",
    description: "Beschreibung", qty: "Menge", rate: "Preis", amount: "Betrag",
    subtotal: "Zwischensumme", tax: "Steuer", discount: "Rabatt", total: "Gesamt",
    totalDue: "Fälliger Betrag", paid: "Bezahlt", balanceDue: "Offener Betrag",
    payOnline: "Online bezahlen", notes: "Notizen", terms: "Bedingungen", noLines: "Noch keine Positionen",
    st_draft: "Entwurf", st_sent: "Gesendet", st_viewed: "Angesehen", st_paid: "Bezahlt",
    st_overdue: "Überfällig", st_accepted: "Angenommen", st_declined: "Abgelehnt",
    po: "Bestellnummer", shipping: "Versand",
  },
  pt: {
    docInvoice: "Fatura", docEstimate: "Orçamento",
    issued: "Emitida", due: "Vencimento", billedTo: "Faturar a", status: "Estado",
    description: "Descrição", qty: "Qtd.", rate: "Preço", amount: "Valor",
    subtotal: "Subtotal", tax: "Imposto", discount: "Desconto", total: "Total",
    totalDue: "Total a pagar", paid: "Pago", balanceDue: "Saldo devedor",
    payOnline: "Pagar online", notes: "Notas", terms: "Condições", noLines: "Ainda sem itens",
    st_draft: "Rascunho", st_sent: "Enviada", st_viewed: "Vista", st_paid: "Paga",
    st_overdue: "Vencida", st_accepted: "Aceite", st_declined: "Recusado",
    po: "Nº de encomenda", shipping: "Envio",
  },
  it: {
    docInvoice: "Fattura", docEstimate: "Preventivo",
    issued: "Emessa", due: "Scadenza", billedTo: "Fatturato a", status: "Stato",
    description: "Descrizione", qty: "Qtà", rate: "Prezzo", amount: "Importo",
    subtotal: "Subtotale", tax: "IVA", discount: "Sconto", total: "Totale",
    totalDue: "Totale dovuto", paid: "Pagato", balanceDue: "Saldo dovuto",
    payOnline: "Paga online", notes: "Note", terms: "Termini", noLines: "Ancora nessuna voce",
    st_draft: "Bozza", st_sent: "Inviata", st_viewed: "Vista", st_paid: "Pagata",
    st_overdue: "Scaduta", st_accepted: "Accettato", st_declined: "Rifiutato",
    po: "N. ordine", shipping: "Spedizione",
  },
  nl: {
    docInvoice: "Factuur", docEstimate: "Offerte",
    issued: "Uitgegeven", due: "Vervaldatum", billedTo: "Factuur aan", status: "Status",
    description: "Omschrijving", qty: "Aantal", rate: "Tarief", amount: "Bedrag",
    subtotal: "Subtotaal", tax: "Btw", discount: "Korting", total: "Totaal",
    totalDue: "Te betalen", paid: "Betaald", balanceDue: "Openstaand bedrag",
    payOnline: "Online betalen", notes: "Notities", terms: "Voorwaarden", noLines: "Nog geen regels",
    st_draft: "Concept", st_sent: "Verzonden", st_viewed: "Bekeken", st_paid: "Betaald",
    st_overdue: "Te laat", st_accepted: "Geaccepteerd", st_declined: "Afgewezen",
    po: "PO-nummer", shipping: "Verzendkosten",
  },
  id: {
    docInvoice: "Faktur", docEstimate: "Penawaran",
    issued: "Diterbitkan", due: "Jatuh tempo", billedTo: "Ditagihkan kepada", status: "Status",
    description: "Deskripsi", qty: "Jml", rate: "Harga", amount: "Jumlah",
    subtotal: "Subtotal", tax: "Pajak", discount: "Diskon", total: "Total",
    totalDue: "Total tagihan", paid: "Dibayar", balanceDue: "Sisa tagihan",
    payOnline: "Bayar online", notes: "Catatan", terms: "Ketentuan", noLines: "Belum ada item",
    st_draft: "Draf", st_sent: "Terkirim", st_viewed: "Dilihat", st_paid: "Lunas",
    st_overdue: "Terlambat", st_accepted: "Diterima", st_declined: "Ditolak",
    po: "No. PO", shipping: "Ongkos kirim",
  },
  vi: {
    docInvoice: "Hóa đơn", docEstimate: "Báo giá",
    issued: "Ngày lập", due: "Hạn thanh toán", billedTo: "Khách hàng", status: "Trạng thái",
    description: "Mô tả", qty: "SL", rate: "Đơn giá", amount: "Thành tiền",
    subtotal: "Tạm tính", tax: "Thuế", discount: "Giảm giá", total: "Tổng cộng",
    totalDue: "Tổng phải trả", paid: "Đã trả", balanceDue: "Còn lại",
    payOnline: "Thanh toán trực tuyến", notes: "Ghi chú", terms: "Điều khoản", noLines: "Chưa có mục nào",
    st_draft: "Nháp", st_sent: "Đã gửi", st_viewed: "Đã xem", st_paid: "Đã thanh toán",
    st_overdue: "Quá hạn", st_accepted: "Đã chấp nhận", st_declined: "Đã từ chối",
    po: "Số PO", shipping: "Phí vận chuyển",
  },
  ja: {
    docInvoice: "請求書", docEstimate: "見積書",
    issued: "発行日", due: "支払期限", billedTo: "請求先", status: "ステータス",
    description: "内容", qty: "数量", rate: "単価", amount: "金額",
    subtotal: "小計", tax: "税", discount: "割引", total: "合計",
    totalDue: "ご請求額", paid: "支払済", balanceDue: "未払残高",
    payOnline: "オンライン支払い", notes: "備考", terms: "条件", noLines: "項目がありません",
    st_draft: "下書き", st_sent: "送信済", st_viewed: "閲覧済", st_paid: "支払済",
    st_overdue: "期限超過", st_accepted: "承認済", st_declined: "却下",
    po: "注文書番号", shipping: "送料",
  },
  zh: {
    docInvoice: "发票", docEstimate: "报价单",
    issued: "开具日期", due: "到期日", billedTo: "付款方", status: "状态",
    description: "描述", qty: "数量", rate: "单价", amount: "金额",
    subtotal: "小计", tax: "税", discount: "折扣", total: "合计",
    totalDue: "应付总额", paid: "已付", balanceDue: "未付余额",
    payOnline: "在线支付", notes: "备注", terms: "条款", noLines: "暂无项目",
    st_draft: "草稿", st_sent: "已发送", st_viewed: "已查看", st_paid: "已付款",
    st_overdue: "逾期", st_accepted: "已接受", st_declined: "已拒绝",
    po: "采购订单号", shipping: "运费",
  },
  ko: {
    docInvoice: "청구서", docEstimate: "견적서",
    issued: "발행일", due: "지급 기한", billedTo: "청구 대상", status: "상태",
    description: "내용", qty: "수량", rate: "단가", amount: "금액",
    subtotal: "소계", tax: "세금", discount: "할인", total: "합계",
    totalDue: "청구 금액", paid: "지급됨", balanceDue: "미지급 잔액",
    payOnline: "온라인 결제", notes: "비고", terms: "약관", noLines: "항목이 없습니다",
    st_draft: "임시", st_sent: "발송됨", st_viewed: "열람됨", st_paid: "지급됨",
    st_overdue: "연체", st_accepted: "수락됨", st_declined: "거절됨",
    po: "발주 번호", shipping: "배송비",
  },
  th: {
    docInvoice: "ใบแจ้งหนี้", docEstimate: "ใบเสนอราคา",
    issued: "วันที่ออก", due: "ครบกำหนด", billedTo: "เรียกเก็บจาก", status: "สถานะ",
    description: "รายละเอียด", qty: "จำนวน", rate: "ราคาต่อหน่วย", amount: "จำนวนเงิน",
    subtotal: "ยอดรวมย่อย", tax: "ภาษี", discount: "ส่วนลด", total: "รวม",
    totalDue: "ยอดที่ต้องชำระ", paid: "ชำระแล้ว", balanceDue: "ยอดค้างชำระ",
    payOnline: "ชำระเงินออนไลน์", notes: "หมายเหตุ", terms: "เงื่อนไข", noLines: "ยังไม่มีรายการ",
    st_draft: "ร่าง", st_sent: "ส่งแล้ว", st_viewed: "เปิดดูแล้ว", st_paid: "ชำระแล้ว",
    st_overdue: "เกินกำหนด", st_accepted: "ยอมรับแล้ว", st_declined: "ปฏิเสธแล้ว",
    po: "เลขที่ใบสั่งซื้อ", shipping: "ค่าจัดส่ง",
  },
};

/** Resolve the full label set for a language (English-filled for any gaps). */
export function getLabels(lang: string | undefined): Record<LabelKey, string> {
  const over = (lang && DICT[lang]) || undefined;
  if (!over || over === EN) return EN;
  return { ...EN, ...over };
}

/** Locale-format an ISO (yyyy-mm-dd) date for the target language. */
export function formatDateFor(iso: string | undefined, locale: string): string {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    // build a UTC date so the calendar day never shifts across time zones
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return iso;
  }
}

/** Map an InvoiceStatus to its label key. */
export function statusKey(status: string): LabelKey {
  const k = `st_${status}` as LabelKey;
  return (k in EN ? k : "st_draft");
}
