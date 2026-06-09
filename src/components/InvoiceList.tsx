import { useMemo, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { invoices, clients, today } from "../db/repos";
import type { Invoice, Client, InvoiceStatus, DocType } from "../db/types";
import { formatMoney, isOverdue } from "../lib/totals";
import Logo from "./LogoReact";
import { ImportCsvModal } from "./ImportCsvModal";
import { exportInvoicesCsv, exportClientsCsv, exportAllInvoicesPdf } from "../lib/export";

const INVOICE_FILTERS: Array<InvoiceStatus | "all"> = ["all", "draft", "sent", "viewed", "paid", "overdue"];
const ESTIMATE_FILTERS: Array<InvoiceStatus | "all"> = ["all", "draft", "sent", "accepted", "declined"];

export default function InvoiceList() {
  const list = useLiveQuery(() => invoices.list(), [], undefined as Invoice[] | undefined);
  const clientList = useLiveQuery(() => clients.all(), [], [] as Client[]);
  const [tab, setTab] = useState<DocType>("invoice");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [showImport, setShowImport] = useState(false);
  // Flow 3: landing "Import a CSV" deep-links to /app?import=1
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("import")) setShowImport(true);
  }, []);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const td = today();

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2600); }
  async function doExport(fn: () => Promise<number>, label: string) {
    setExportOpen(false);
    const n = await fn();
    flash(n === 0 ? "Nothing to export yet." : `✓ Exported ${n} ${label}`);
  }
  const clientName = (id?: string) => clientList.find((c) => c.id === id)?.name ?? "—";

  const isEstimate = tab === "estimate";
  const counts = useMemo(() => {
    const c = { invoice: 0, estimate: 0 };
    (list ?? []).forEach((inv) => { c[(inv.docType ?? "invoice") as DocType]++; });
    return c;
  }, [list]);

  // Flow 5: the one key figure for a list (not a dashboard) — outstanding & overdue.
  const money = useMemo(() => {
    const invs = (list ?? []).filter((i) => (i.docType ?? "invoice") === "invoice");
    let outstanding = 0, overdue = 0, ccy = "USD";
    invs.forEach((i) => {
      if (i.status === "paid" || i.status === "draft") return;
      ccy = i.currency;
      outstanding += i.total;
      if (isOverdue(i, td)) overdue += i.total;
    });
    return { outstanding, overdue, ccy };
  }, [list, td]);

  const rows = useMemo(() => {
    if (!list) return [];
    return list
      .filter((inv) => (inv.docType ?? "invoice") === tab)
      .map((inv) => ({ inv, displayStatus: !isEstimate && isOverdue(inv, td) ? ("overdue" as InvoiceStatus) : inv.status }))
      .filter(({ inv, displayStatus }) => {
        if (filter !== "all" && displayStatus !== filter) return false;
        if (!q.trim()) return true;
        return `${inv.number} ${clientName(inv.clientId)}`.toLowerCase().includes(q.toLowerCase());
      });
  }, [list, q, filter, clientList, td, tab, isEstimate]);

  if (!list) return <div style={{ padding: "3rem", color: "var(--ink-faint)" }}>Loading…</div>;

  return (
    <>
      <div className="app-bar">
        <div className="app-bar-in">
          <Logo />
          <div className="app-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>Import CSV</button>
            <div style={{ position: "relative" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setExportOpen((o) => !o)}>Export ▾</button>
              {exportOpen && (
                <div style={menuStyle} onMouseLeave={() => setExportOpen(false)}>
                  <button style={menuItem} onClick={() => doExport(exportInvoicesCsv, "invoices to CSV")}>Invoices (CSV)</button>
                  <button style={menuItem} onClick={() => doExport(exportClientsCsv, "clients to CSV")}>Clients (CSV)</button>
                  <button style={menuItem} onClick={() => doExport(exportAllInvoicesPdf, "invoices to PDF")}>All invoices (PDF)</button>
                </div>
              )}
            </div>
            <a className="btn btn-primary btn-sm" href={isEstimate ? "/new?type=estimate" : "/new"}>＋ New {isEstimate ? "estimate" : "invoice"}</a>
          </div>
        </div>
      </div>

      <div className="list-wrap">
        <div className="doc-tabs">
          <button className={`doc-tab${!isEstimate ? " on" : ""}`} onClick={() => { setTab("invoice"); setFilter("all"); }}>Invoices{counts.invoice ? ` (${counts.invoice})` : ""}</button>
          <button className={`doc-tab${isEstimate ? " on" : ""}`} onClick={() => { setTab("estimate"); setFilter("all"); }}>Estimates{counts.estimate ? ` (${counts.estimate})` : ""}</button>
        </div>
        <div className="list-head">
          <div className="list-title">
            <h1>{isEstimate ? "Estimates" : "Invoices"}</h1>
            {!isEstimate && money.outstanding > 0 && (
              <div className="list-summary">
                <span className="num">{formatMoney(money.outstanding, money.ccy)}</span> outstanding
                {money.overdue > 0 && <span className="overdue-fig"> · <span className="num">{formatMoney(money.overdue, money.ccy)}</span> overdue</span>}
              </div>
            )}
          </div>
          <div className="list-controls">
            <input placeholder="Search number or client…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={filter} onChange={(e) => setFilter(e.target.value as InvoiceStatus | "all")}>
              {(isEstimate ? ESTIMATE_FILTERS : INVOICE_FILTERS).map((f) => <option key={f} value={f}>{f === "all" ? "All statuses" : f[0].toUpperCase() + f.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            {counts[tab] === 0 ? (
              <>
                <p style={{ marginBottom: "1rem" }}>No {isEstimate ? "estimates" : "invoices"} yet.</p>
                <a className="btn btn-primary" href={isEstimate ? "/new?type=estimate" : "/new"}>Create your first {isEstimate ? "estimate" : "invoice"}</a>
              </>
            ) : `No ${isEstimate ? "estimates" : "invoices"} match your filter.`}
          </div>
        ) : (
          <table className="inv-table">
            <thead>
              <tr>
                <th>Number</th><th>Client</th><th>Issued</th><th>Status</th><th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ inv, displayStatus }) => (
                <tr key={inv.id} onClick={() => { window.location.href = `/${(inv.docType ?? "invoice") === "estimate" ? "estimate" : "invoice"}?id=${inv.id}`; }}>
                  <td className="mono">{inv.number}</td>
                  <td>{clientName(inv.clientId)}</td>
                  <td className="mono" style={{ color: "var(--ink-faint)" }}>{inv.issueDate}</td>
                  <td><span className={`chip ${displayStatus}`}>{displayStatus[0].toUpperCase() + displayStatus.slice(1)}</span></td>
                  <td className="num mono">{formatMoney(inv.total, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showImport && <ImportCsvModal onClose={() => setShowImport(false)} onDone={(msg) => { setShowImport(false); flash(msg); }} />}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

const menuStyle: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30,
  background: "var(--paper-3)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
  boxShadow: "var(--shadow)", padding: 4, minWidth: 180,
};
const menuItem: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: ".5rem .7rem",
  fontSize: ".85rem", color: "var(--ink)", background: "none", border: "none", borderRadius: 6, cursor: "pointer",
};
