import { useState } from "react";
import { useEscape } from "../lib/useEscape";
import { useLiveQuery } from "dexie-react-hooks";
import { items as itemRepo } from "../db/repos";
import type { Item } from "../db/types";
import { formatMoney } from "../lib/totals";

// Manage the saved item/service catalog (Spec §5: "client/item catalog").
export function ItemsModal({ currency, onClose }: { currency: string; onClose: () => void }) {
  const list = useLiveQuery(() => itemRepo.all(), [], [] as Item[]);
  useEscape(onClose);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");

  async function add() {
    if (!name.trim()) return;
    const r = parseFloat(rate);
    await itemRepo.upsertByName(name, Number.isFinite(r) ? r : 0); // rate optional, defaults to 0
    setName(""); setRate("");
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>
        <h3>Saved items</h3>
        <p className="m-lead">Reusable products &amp; services. Pick them by name on any invoice to auto-fill the rate.</p>

        {list.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: "1rem" }}>
            {list.map((it) => (
              <div key={it.id} style={rowStyle}>
                <span style={{ flex: 1 }}>{it.name}</span>
                <span className="mono" style={{ color: "var(--ink-soft)" }}>{formatMoney(it.defaultRate, currency)}</span>
                <button className="del" aria-label={`Delete ${it.name}`} onClick={() => itemRepo.remove(it.id)} style={{ border: "none", background: "none" }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: ".5rem", alignItems: "end" }}>
          <div className="fld" style={{ margin: 0 }}><label>Item or service</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Strategy session" /></div>
          <div className="fld" style={{ margin: 0 }}><label>Rate</label><input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" /></div>
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!name.trim()}>Add</button>
        </div>
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: ".6rem",
  padding: ".5rem 0", borderBottom: "1px solid var(--line)", fontSize: ".9rem",
};
