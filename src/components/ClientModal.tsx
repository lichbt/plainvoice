import { useState } from "react";
import { clients } from "../db/repos";
import type { Client } from "../db/types";

// Add/edit a saved client (the client catalog). Captured just-in-time from the editor.
export function ClientModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Client;
  onClose: () => void;
  onSaved: (client: Client) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const rec = await clients.save({
      id: initial?.id, name: name.trim(),
      email: email || undefined, address: address || undefined, notes: notes || undefined,
    });
    setSaving(false);
    onSaved(rec);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <h3>{initial ? "Edit client" : "New client"}</h3>
        <p className="m-lead">Saved to your client list for next time.</p>
        <div className="fld"><label>Name</label><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div className="fld"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="fld"><label>Address</label><textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="fld"><label>Notes</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!name.trim() || saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
