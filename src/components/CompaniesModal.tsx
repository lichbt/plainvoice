import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { businesses as bizRepo } from "../db/repos";
import { db, ensureSettings } from "../db/db";
import type { Business } from "../db/types";
import { BusinessProfileModal } from "./BusinessProfileModal";

// Manager for the saved company list — view, add, edit, delete.
export function CompaniesModal({ currency, onClose }: { currency: string; onClose: () => void }) {
  const list = useLiveQuery(() => bizRepo.all(), [], [] as Business[]);
  const [edit, setEdit] = useState<Business | "new" | null>(null);

  async function remove(b: Business) {
    if (!confirm(`Delete "${b.name}"? This can't be undone.`)) return;
    await bizRepo.remove(b.id);
    const s = await ensureSettings();
    if (s.activeBusinessId === b.id) {
      const next = (await bizRepo.all())[0];
      await db.settings.update("singleton", { activeBusinessId: next?.id });
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
          <h3>Saved companies</h3>
          <p className="m-lead">Your businesses. Pick which one issues each invoice.</p>

          {list.length === 0 ? (
            <div style={{ color: "var(--ink-faint)", fontSize: ".9rem", padding: ".5rem 0 1rem" }}>No companies yet.</div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: "1rem" }}>
              {list.map((b) => (
                <div key={b.id} className="mgr-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    {b.email ? <div style={{ fontSize: ".8rem", color: "var(--ink-faint)" }}>{b.email}</div> : null}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEdit(b)}>Edit</button>
                  <button className="del" aria-label={`Delete ${b.name}`} onClick={() => remove(b)}>×</button>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-ghost btn-sm" onClick={() => setEdit("new")}>+ Add company</button>
        </div>
      </div>

      {edit && (
        <BusinessProfileModal
          initial={edit === "new" ? undefined : edit}
          defaultCurrency={currency}
          onClose={() => setEdit(null)}
          onSaved={() => setEdit(null)}
          onDeleted={() => setEdit(null)}
        />
      )}
    </>
  );
}
