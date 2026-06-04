import { useRef, useState } from "react";
import { parseCsvFile, importClients, importInvoices } from "../lib/csvImport";

type Kind = "clients" | "invoices";

export function ImportCsvModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [kind, setKind] = useState<Kind>("clients");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { rows } = await parseCsvFile(file);
      const count = kind === "clients" ? await importClients(rows) : await importInvoices(rows);
      onDone(`✓ Imported ${count} ${kind === "clients" ? "client" : "invoice"}${count === 1 ? "" : "s"}`);
    } catch (e) {
      setError("Couldn't read that CSV. Check it has a header row.");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!busy && <button className="x" onClick={onClose} aria-label="Close">×</button>}
        <h3>Import from CSV</h3>
        <p className="m-lead">Bring clients or invoices in from a spreadsheet or another app. We map common column names automatically.</p>

        <div className="tone-tabs" style={{ display: "flex", gap: ".4rem", marginBottom: "1rem" }}>
          <button className={`btn btn-sm ${kind === "clients" ? "btn-primary" : "btn-ghost"}`} onClick={() => setKind("clients")}>Clients</button>
          <button className={`btn btn-sm ${kind === "invoices" ? "btn-primary" : "btn-ghost"}`} onClick={() => setKind("invoices")}>Invoices</button>
        </div>

        <div style={{ fontSize: ".82rem", color: "var(--ink-faint)", marginBottom: "1rem" }}>
          {kind === "clients"
            ? "Expected columns: name (required), email, address, notes."
            : "One row per line item. Columns: number, client, issuedate, duedate, currency, description, qty, rate, taxrate."}
        </div>

        {error && <div style={{ color: "var(--red)", fontSize: ".85rem", marginBottom: ".8rem" }}>{error}</div>}

        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Importing…" : "Choose CSV file"}</button>
        </div>
      </div>
    </div>
  );
}
