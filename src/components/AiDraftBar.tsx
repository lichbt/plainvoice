import { useState } from "react";
import { parseAiDraft, type AiInvoiceDraft } from "../lib/aiInvoice";

// Chat-to-invoice input (Flow 2). Value-first: typing a sentence produces an
// editable draft. The AI "uses" counter is shown here and only decrements on a
// successful draft (handled by the parent via onDrafted → consumeAiUse).
export function AiDraftBar({
  knownClients,
  defaultCurrency,
  usesLeft,
  onDrafted,
  autoFocus,
}: {
  knownClients: string[];
  defaultCurrency: string;
  usesLeft: number;
  onDrafted: (draft: AiInvoiceDraft) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const out = usesLeft <= 0;

  async function draft() {
    const t = text.trim();
    if (t.length < 3 || busy || out) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/ai/parse-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, knownClients, defaultCurrency }),
      });
      if (res.status === 503) { setError("AI isn't switched on yet — add it from the editor by hand for now."); return; }
      if (!res.ok) { setError("Couldn't draft that. Add the lines by hand, or try again."); return; }
      const data = (await res.json()) as { draft?: unknown };
      const parsed = parseAiDraft(data.draft);
      if (parsed.lines.length === 0) { setError("Didn't catch any line items — try naming the work and a price."); return; }
      onDrafted(parsed); // parent maps it in + spends one use
      setText("");
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-bar">
      <div className="ai-bar-head">
        <span className="ai-pill">✨ AI</span>
        <span className="ai-bar-title">Describe it, get a draft</span>
        <span className={`ai-uses${out ? " out" : ""}`}>{usesLeft} AI use{usesLeft === 1 ? "" : "s"} left</span>
      </div>
      {out ? (
        <div className="ai-out">
          Out of free AI. <strong>Get 50 more for $5</strong> — <span style={{ color: "var(--ink-faint)" }}>coming soon.</span>
        </div>
      ) : (
        <>
          <div className="ai-bar-row">
            <input
              value={text}
              autoFocus={autoFocus}
              placeholder="e.g. 2h consulting at $120 and a $500 setup fee for Acme, due in 30 days"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") draft(); }}
              aria-label="Describe the invoice"
            />
            <button className="btn btn-primary btn-sm" onClick={draft} disabled={busy || text.trim().length < 3}>
              {busy ? "Drafting…" : "Draft it ✨"}
            </button>
          </div>
          {error && <div className="ai-error">{error}</div>}
        </>
      )}
    </div>
  );
}
