import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { clients as clientRepo } from "../db/repos";
import type { Client } from "../db/types";
import { ClientModal } from "./ClientModal";

// Manager for the saved client list — view, add, edit, delete (Spec §5 catalog).
export function ClientsModal({ onClose }: { onClose: () => void }) {
  const list = useLiveQuery(() => clientRepo.all(), [], [] as Client[]);
  const [edit, setEdit] = useState<Client | "new" | null>(null);

  async function remove(c: Client) {
    if (!confirm(`Delete "${c.name}"? This can't be undone.`)) return;
    await clientRepo.remove(c.id);
  }

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
          <h3>Saved clients</h3>
          <p className="m-lead">Reusable client details. Pick them on any invoice.</p>

          {list.length === 0 ? (
            <div style={{ color: "var(--ink-faint)", fontSize: ".9rem", padding: ".5rem 0 1rem" }}>No clients yet.</div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: "1rem" }}>
              {list.map((c) => (
                <div key={c.id} className="mgr-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.email ? <div style={{ fontSize: ".8rem", color: "var(--ink-faint)" }}>{c.email}</div> : null}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEdit(c)}>Edit</button>
                  <button className="del" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}>×</button>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-ghost btn-sm" onClick={() => setEdit("new")}>+ Add client</button>
        </div>
      </div>

      {edit && (
        <ClientModal
          initial={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
          onSaved={() => setEdit(null)}
        />
      )}
    </>
  );
}
