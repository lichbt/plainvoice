import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureSettings } from "../db/db";
import { businesses, clients, invoices, items, payments, today } from "../db/repos";
import type { Business, Client, Item, InvoiceStatus, DocType, Payment, PaymentMethod } from "../db/types";
import { computeTotals, isOverdue, balanceDue as calcBalance } from "../lib/totals";
import { CURRENCIES } from "../lib/currencies";
import { InvoicePreview, type PreviewData } from "./InvoicePreview";
import { BusinessProfileModal } from "./BusinessProfileModal";
import { ClientModal } from "./ClientModal";
import { PhotoImportModal } from "./PhotoImportModal";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { SendModal } from "./SendModal";
import { ItemsModal } from "./ItemsModal";
import { ClientsModal } from "./ClientsModal";
import { CompaniesModal } from "./CompaniesModal";
import type { OcrLine } from "../lib/ocr";
import { exportInvoicePdf } from "../lib/pdf";
import { ACCENTS, DEFAULT_TEMPLATE } from "../lib/templates";

interface LineState { id: string; description: string; qty: string; rate: string }
const blankLine = (): LineState => ({ id: crypto.randomUUID(), description: "", qty: "1", rate: "0" });
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };

const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "viewed", "paid"];
const ESTIMATE_STATUSES: InvoiceStatus[] = ["draft", "sent", "accepted", "declined"];

export default function InvoiceEditor({ invoiceId }: { invoiceId?: string }) {
  const initialId =
    invoiceId ??
    (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") ?? undefined : undefined);
  const [id, setId] = useState<string | undefined>(initialId);
  const [loaded, setLoaded] = useState(false);

  // doc type: "estimate" for new docs via /new?type=estimate; otherwise from the loaded record
  const initialDocType: DocType =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("type") === "estimate"
      ? "estimate" : "invoice";
  const [docType, setDocType] = useState<DocType>(initialDocType);

  const [clientId, setClientId] = useState<string | undefined>();
  const [businessId, setBusinessId] = useState<string | undefined>();
  const [number, setNumber] = useState("");
  const [status, setStatusState] = useState<InvoiceStatus>("draft");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE.id);
  const [accentColor, setAccentColor] = useState<string>("");
  const [lines, setLines] = useState<LineState[]>([blankLine()]);
  // null = closed, "new" = add company, Business = edit that company
  const [profileEdit, setProfileEdit] = useState<Business | "new" | null>(null);
  const [clientModal, setClientModal] = useState<null | "new" | "edit">(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [showClients, setShowClients] = useState(false);
  const [showCompanies, setShowCompanies] = useState(false);
  const [barMenu, setBarMenu] = useState<null | "status" | "more" | "color">(null);
  const [toast, setToast] = useState<string | null>(null);
  const pendingPdf = useRef(false);

  const clientList = useLiveQuery(() => clients.all(), [], [] as Client[]);
  const itemList = useLiveQuery(() => items.all(), [], [] as Item[]);
  const businessList = useLiveQuery(() => businesses.all(), [], [] as Business[]);
  const paymentList = useLiveQuery(async () => (id ? await payments.forInvoice(id) : ([] as Payment[])), [id], [] as Payment[]);

  useEffect(() => {
    (async () => {
      if (initialId) {
        const found = await invoices.getWithLines(initialId);
        if (found) {
          const { invoice, lines: ls } = found;
          setDocType(invoice.docType ?? "invoice");
          setClientId(invoice.clientId);
          setBusinessId(invoice.businessId ?? (await db.settings.get("singleton"))?.activeBusinessId ?? (await businesses.all())[0]?.id);
          setNumber(invoice.number);
          setStatusState(invoice.status);
          setIssueDate(invoice.issueDate);
          setDueDate(invoice.dueDate ?? "");
          setCurrency(invoice.currency);
          setTaxRate(String(ls[0]?.taxRate ?? 0));
          setDiscount(String(invoice.discount));
          setNotes(invoice.notes ?? "");
          setTerms(invoice.terms ?? "");
          setTemplate(invoice.template ?? DEFAULT_TEMPLATE.id);
          setAccentColor(invoice.accentColor ?? "");
          setLines(ls.length ? ls.map((l) => ({ id: l.id, description: l.description, qty: String(l.qty), rate: String(l.rate) })) : [blankLine()]);
          setLoaded(true);
          return;
        }
      }
      const next = await invoices.nextNumber(initialDocType);
      const s = await ensureSettings();
      const all = await businesses.all();
      const b = all.find((x) => x.id === s.activeBusinessId) ?? all[0];
      setNumber(next);
      setBusinessId(b?.id);
      if (b?.defaultCurrency) setCurrency(b.defaultCurrency);
      setLoaded(true);
      // photo-import entry point from the landing page (?photo=1)
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("photo")) {
        setShowPhoto(true);
      }
    })();
  }, [initialId]);

  // single invoice-level tax applied to every line (per data model still per-line)
  const taxNum = num(taxRate);
  const computeLines = useMemo(
    () => lines.map((l) => ({ qty: num(l.qty), rate: num(l.rate), taxRate: taxNum })),
    [lines, taxNum],
  );
  const totals = useMemo(
    () => computeTotals({ currency, discount: num(discount), lines: computeLines }),
    [currency, discount, computeLines],
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(async (): Promise<string> => {
    const { invoice } = await invoices.save({
      id, clientId, businessId, number, docType, status, issueDate,
      dueDate: dueDate || undefined, currency, discount: num(discount),
      notes: notes || undefined, terms: terms || undefined,
      template, accentColor: accentColor || undefined,
      lines: lines.map((l) => ({ id: l.id, description: l.description, qty: num(l.qty), rate: num(l.rate), taxRate: taxNum })),
    });
    if (!id) { setId(invoice.id); window.history.replaceState(null, "", `/${docType === "estimate" ? "estimate" : "invoice"}?id=${invoice.id}`); }
    return invoice.id;
  }, [id, clientId, businessId, number, docType, status, issueDate, dueDate, currency, discount, notes, terms, template, accentColor, lines, taxNum]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persist(); }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [loaded, persist]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2600); }

  // If the selected client/company gets deleted in a manager, drop/fall back.
  useEffect(() => {
    if (loaded && clientId && clientList.length >= 0 && !clientList.some((c) => c.id === clientId)) setClientId(undefined);
  }, [clientList, clientId, loaded]);
  useEffect(() => {
    if (loaded && businessId && businessList.length > 0 && !businessList.some((b) => b.id === businessId)) setBusinessId(businessList[0]?.id);
  }, [businessList, businessId, loaded]);

  const client = clientList.find((c) => c.id === clientId);
  const business = businessList.find((b) => b.id === businessId) ?? businessList[0];
  const isEstimate = docType === "estimate";
  // overdue only applies to invoices
  const displayStatus: InvoiceStatus = !isEstimate && isOverdue({ status, dueDate: dueDate || undefined }, today()) ? "overdue" : status;
  const paid = paymentList.reduce((s, p) => s + p.amount, 0);
  const balance = calcBalance(totals.total, paymentList, currency);

  const preview: PreviewData = {
    business: business ? { name: business.name, logoDataUrl: business.logoDataUrl, address: business.address, email: business.email, taxId: business.taxId } : undefined,
    client: client ? { name: client.name, email: client.email, address: client.address } : undefined,
    number, docType, status: displayStatus, issueDate, dueDate: dueDate || undefined, currency,
    lines: lines.map((l, i) => ({ description: l.description, qty: num(l.qty), rate: num(l.rate), amount: totals.lineAmounts[i] })),
    subtotal: totals.subtotal, taxTotal: totals.taxTotal, discount: totals.discount, total: totals.total,
    paid: isEstimate ? undefined : (paid > 0 ? paid : undefined),
    notes: notes || undefined, terms: terms || undefined,
    paymentLink: isEstimate ? undefined : business?.paymentLink, // estimates aren't payable

    template, accentColor: accentColor || undefined,
  };

  const setLine = (i: number, patch: Partial<LineState>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // Typing/picking a description that matches a saved item auto-fills its rate
  // (only when the rate hasn't been set yet, so we never clobber a manual edit).
  function changeDescription(i: number, value: string) {
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      const match = itemList.find((it) => it.name.toLowerCase() === value.trim().toLowerCase());
      const rate = match && (l.rate === "" || num(l.rate) === 0) ? String(match.defaultRate) : l.rate;
      return { ...l, description: value, rate };
    }));
  }

  async function saveLineToCatalog(l: LineState) {
    if (!l.description.trim()) return;
    await items.upsertByName(l.description, num(l.rate));
    flash(`✓ "${l.description.trim()}" saved to your items`);
  }

  // Insert a saved item as a line. Fills the last blank line, else appends one.
  function insertSavedItem(itemId: string) {
    const it = itemList.find((x) => x.id === itemId);
    if (!it) return;
    const line: LineState = { id: crypto.randomUUID(), description: it.name, qty: "1", rate: String(it.defaultRate) };
    setLines((ls) => {
      const last = ls[ls.length - 1];
      const lastBlank = last && !last.description.trim() && num(last.rate) === 0;
      return lastBlank ? [...ls.slice(0, -1), { ...line, id: last.id }] : [...ls, line];
    });
  }

  function onPhotoResult(ocr: OcrLine[]) {
    const mapped: LineState[] = ocr.map((o) => ({ id: crypto.randomUUID(), description: o.description, qty: String(o.qty), rate: String(o.rate) }));
    // replace if the invoice is still empty, otherwise append
    const empty = lines.length === 1 && !lines[0].description && num(lines[0].rate) === 0;
    setLines(empty ? mapped : [...lines, ...mapped]);
    setShowPhoto(false);
    flash(`✓ Loaded ${mapped.length} line item${mapped.length === 1 ? "" : "s"} from photo · on-device, free`);
  }

  async function changeStatus(s: InvoiceStatus) {
    setStatusState(s);
    const savedId = await persist();
    await invoices.setStatus(savedId, s);
    if (s === "paid") flash("🎉 Marked as paid");
  }

  async function recordPayment(amount: number, method: PaymentMethod, ref?: string) {
    const savedId = await persist();
    await payments.record({ invoiceId: savedId, amount, method, ref });
    const newBalance = calcBalance(totals.total, [...paymentList, { amount }], currency);
    if (newBalance <= 0) { setStatusState("paid"); await invoices.setStatus(savedId, "paid"); flash("🎉 Paid in full"); }
    else flash(`Recorded ${new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)} · balance ${new Intl.NumberFormat(undefined, { style: "currency", currency }).format(newBalance)}`);
    setShowPayment(false);
  }

  async function sendInvoice() {
    if (!business?.name) { setShowSend(false); setProfileEdit("new"); return; }
    await persist();
    await exportInvoicePdf(preview);
    if (status === "draft") { setStatusState("sent"); const sid = await persist(); await invoices.setStatus(sid, "sent"); }
  }

  async function handlePdf() {
    if (!business?.name) { pendingPdf.current = true; setProfileEdit("new"); return; }
    await persist();
    await exportInvoicePdf(preview);
  }

  async function convertToInvoice() {
    const savedId = await persist();
    const newId = await invoices.convertToInvoice(savedId);
    flash("✓ Created an invoice from this estimate");
    window.location.href = `/invoice?id=${newId}`;
  }

  async function onProfileSaved(saved: Business) {
    setProfileEdit(null);
    setBusinessId(saved.id); // use the just-added/edited company on this doc
    if (pendingPdf.current) {
      pendingPdf.current = false;
      await persist();
      await exportInvoicePdf({ ...preview, business: { name: saved.name, logoDataUrl: saved.logoDataUrl, address: saved.address, email: saved.email, taxId: saved.taxId } });
    }
  }

  async function onProfileDeleted(deletedId: string) {
    setProfileEdit(null);
    if (businessId === deletedId) setBusinessId((await businesses.all())[0]?.id);
  }

  if (!loaded) return <div style={{ padding: "3rem", color: "var(--ink-faint)" }}>Loading…</div>;

  return (
    <>
      <div className="app-bar">
        <div className="app-bar-in">
          <div className="left">
            <a className="back" href="/app">← All {isEstimate ? "estimates" : "invoices"}</a>
            {/* status chip doubles as the status dropdown */}
            <div className="bar-pop">
              <button className={`chip chip-btn ${displayStatus}`} onClick={() => setBarMenu(barMenu === "status" ? null : "status")}>
                {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)} <span className="caret">▾</span>
              </button>
              {barMenu === "status" && (
                <div className="bar-menu">
                  {(isEstimate ? ESTIMATE_STATUSES : INVOICE_STATUSES).map((s) => (
                    <button key={s} className="bar-menu-item" onClick={() => { setBarMenu(null); changeStatus(s); }}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="app-actions">
            <div className="bar-pop">
              <button className={`color-trigger${template === "classic" ? " is-white" : ""}`} aria-label="Invoice color"
                style={template === "classic" ? undefined : { background: accentColor || "#1E5B41" }}
                onClick={() => setBarMenu(barMenu === "color" ? null : "color")} />
              {barMenu === "color" && (
                <div className="bar-menu" style={{ padding: ".6rem" }}>
                  <div className="accent-row">
                    <button type="button" title="Classic (no color)"
                      className={`accent-dot accent-white${template === "classic" ? " on" : ""}`}
                      onClick={() => { setBarMenu(null); setTemplate("classic"); setAccentColor(""); }} />
                    {ACCENTS.map((c) => {
                      const active = template !== "classic" && accentColor === c;
                      return (
                        <button key={c} type="button" title={c} className={`accent-dot${active ? " on" : ""}`}
                          style={{ background: c }} onClick={() => { setBarMenu(null); setTemplate("trades"); setAccentColor(c); }} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="bar-pop">
              <button className="btn btn-ghost btn-sm" onClick={() => setBarMenu(barMenu === "more" ? null : "more")}>⋯ More</button>
              {barMenu === "more" && (
                <div className="bar-menu" style={{ right: 0 }}>
                  <button className="bar-menu-item" onClick={() => { setBarMenu(null); setShowPhoto(true); }}>📷 From photo</button>
                  {isEstimate
                    ? <button className="bar-menu-item" onClick={() => { setBarMenu(null); convertToInvoice(); }}>Convert to invoice</button>
                    : <button className="bar-menu-item" onClick={() => { setBarMenu(null); setShowPayment(true); }}>Record payment</button>}
                </div>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handlePdf}>Download PDF</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowSend(true)}>Send</button>
          </div>
        </div>
      </div>
      {barMenu && <div className="bar-backdrop" onClick={() => setBarMenu(null)} />}

      <div className="editor">
        {/* form */}
        <div>
          <div className="panel">
            <h3>Details</h3>
            <div className="row2">
              <div className="fld"><label>Invoice #</label><input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
              <div className="fld"><label>Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="row2">
              <div className="fld"><label>Issue date</label><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
              <div className="fld"><label>Due date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            </div>
            <div className="fld">
              <div className="fld-head">
                <label>From (your company)</label>
                <button type="button" className="fld-link" onClick={() => setShowCompanies(true)}>Saved companies{businessList.length ? ` (${businessList.length})` : ""}</button>
              </div>
              <select value={businessId ?? ""} aria-label="From (your company)"
                onChange={(e) => { if (e.target.value === "__new__") { setProfileEdit("new"); return; } setBusinessId(e.target.value || undefined); }}>
                {businessList.length === 0 ? <option value="">— No company —</option> : null}
                {businessList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                <option value="__new__">+ Add company…</option>
              </select>
            </div>
            <div className="fld">
              <div className="fld-head">
                <label>Client</label>
                <button type="button" className="fld-link" onClick={() => setShowClients(true)}>Saved clients{clientList.length ? ` (${clientList.length})` : ""}</button>
              </div>
              <select value={clientId ?? ""} aria-label="Client"
                onChange={(e) => { if (e.target.value === "__new__") { setClientModal("new"); return; } setClientId(e.target.value || undefined); }}>
                <option value="">— No client —</option>
                {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ Add new client…</option>
              </select>
            </div>
          </div>

          <div className="panel" style={{ marginTop: "1.2rem" }}>
            <h3>
              <span>Line items <span style={{ fontSize: ".74rem", fontWeight: 400, color: "var(--ink-faint)" }}>qty × rate</span></span>
              <button className="add-li" style={{ margin: 0 }} onClick={() => setShowItems(true)}>Saved items{itemList.length ? ` (${itemList.length})` : ""}</button>
            </h3>
            <div className="li-head"><span>Description</span><span>Qty</span><span>Rate</span><span style={{ textAlign: "right" }}>Amount</span><span></span></div>
            {lines.map((l, i) => (
              <div className="li" key={l.id}>
                <input value={l.description} placeholder="Item or service" aria-label="Description" onChange={(e) => changeDescription(i, e.target.value)} />
                <div className="li-field"><span className="li-lab">Qty</span>
                  <input type="number" value={l.qty} aria-label="Quantity" onChange={(e) => setLine(i, { qty: e.target.value })} /></div>
                <div className="li-field"><span className="li-lab">Rate</span>
                  <input type="number" value={l.rate} aria-label="Rate" onChange={(e) => setLine(i, { rate: e.target.value })} /></div>
                <span className="amt">{totals.lineAmounts[i] !== undefined ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(totals.lineAmounts[i]) : ""}</span>
                <div className="li-actions">
                  <button className="save" title="Save to your items" aria-label="Save to your items" disabled={!l.description.trim()} onClick={() => saveLineToCatalog(l)}>＋</button>
                  <button className="del" aria-label="Remove line" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))}>×</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <button className="add-li" onClick={() => setLines((ls) => [...ls, blankLine()])}>＋ Add line item</button>
              {itemList.length > 0 && (
                <select className="add-saved" value="" aria-label="Insert a saved item"
                  onChange={(e) => { if (e.target.value) { insertSavedItem(e.target.value); e.target.value = ""; } }}>
                  <option value="">+ Insert saved item ▾</option>
                  {itemList.map((it) => <option key={it.id} value={it.id}>{it.name} · {fmt(it.defaultRate, currency)}</option>)}
                </select>
              )}
            </div>

            <div className="row2" style={{ marginTop: "1.1rem" }}>
              <div className="fld"><label>Tax %</label><input type="number" aria-label="Tax %" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
              <div className="fld"><label>Discount</label><input type="number" aria-label="Discount" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            </div>
            <div className="fld"><label>Notes / terms</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thanks for your business! Payment due within 14 days." /></div>

            <div className="totals">
              <div className="tot-row"><span>Subtotal</span><span className="mono">{fmt(totals.subtotal, currency)}</span></div>
              {totals.taxTotal > 0 ? <div className="tot-row"><span>Tax</span><span className="mono">{fmt(totals.taxTotal, currency)}</span></div> : null}
              {totals.discount > 0 ? <div className="tot-row"><span>Discount</span><span className="mono">−{fmt(totals.discount, currency)}</span></div> : null}
              {paid > 0 ? (
                <>
                  <div className="tot-row"><span>Total</span><span className="mono">{fmt(totals.total, currency)}</span></div>
                  <div className="tot-row"><span>Paid</span><span className="mono">−{fmt(paid, currency)}</span></div>
                  <div className="tot-row grand"><span>Balance due</span><span className="mono v">{fmt(balance, currency)}</span></div>
                </>
              ) : (
                <div className="tot-row grand"><span>{isEstimate ? "Total" : "Total due"}</span><span className="mono v">{fmt(totals.total, currency)}</span></div>
              )}
            </div>
          </div>
        </div>

        {/* live preview */}
        <div className="preview-wrap">
          <InvoicePreview data={preview} />
        </div>
      </div>

      {clientModal && (
        <ClientModal initial={clientModal === "edit" ? client : undefined}
          onClose={() => setClientModal(null)}
          onSaved={(c) => { setClientId(c.id); setClientModal(null); }} />
      )}
      {profileEdit && (
        <BusinessProfileModal
          initial={profileEdit === "new" ? undefined : profileEdit}
          defaultCurrency={currency}
          onClose={() => { pendingPdf.current = false; setProfileEdit(null); }}
          onSaved={onProfileSaved}
          onDeleted={onProfileDeleted} />
      )}
      {showItems && <ItemsModal currency={currency} onClose={() => setShowItems(false)} />}
      {showClients && <ClientsModal onClose={() => setShowClients(false)} />}
      {showCompanies && <CompaniesModal currency={currency} onClose={() => setShowCompanies(false)} />}
      {showPhoto && <PhotoImportModal onClose={() => setShowPhoto(false)} onResult={onPhotoResult} />}
      {showPayment && <RecordPaymentModal currency={currency} balanceDue={balance} onClose={() => setShowPayment(false)} onSave={recordPayment} />}
      {showSend && (
        <SendModal
          to={client?.email ?? ""} number={number} total={totals.total} currency={currency}
          dueDate={dueDate || undefined} businessName={business?.name ?? "your business"} paymentLink={isEstimate ? undefined : business?.paymentLink}
          docNoun={isEstimate ? "Estimate" : "Invoice"}
          onClose={() => setShowSend(false)} onSend={sendInvoice}
        />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

function fmt(n: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n); }
  catch { return `${n} ${currency}`; }
}
