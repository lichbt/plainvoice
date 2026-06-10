import { useRef, useState } from "react";
import { parseAiDraft, type AiInvoiceDraft } from "../lib/aiInvoice";

// Chat-to-invoice input (Flow 2). Value-first: describe the work — or paste a
// whole client chat/email — and get an editable draft. The AI "uses" counter is
// shown here and only decrements on a successful draft (parent → consumeAiUse).
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
  const taRef = useRef<HTMLTextAreaElement>(null);
  const out = usesLeft <= 0;

  // grow the textarea with its content (so a pasted chat is fully visible)
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  }

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
      if (res.status === 413) { setError("That's a lot of text — trim it to the key messages (under ~8,000 characters) and try again."); return; }
      if (res.status === 429) { setError("Hit today's AI limit — add the lines by hand, or try again tomorrow."); return; }
      if (!res.ok) { setError("Couldn't draft that. Add the lines by hand, or try again."); return; }
      const data = (await res.json()) as { draft?: unknown };
      const parsed = parseAiDraft(data.draft);
      if (parsed.lines.length === 0) { setError("Didn't catch any line items — make sure the work and prices are in the text."); return; }
      onDrafted(parsed); // parent maps it in + spends one use
      setText("");
      if (taRef.current) { taRef.current.style.height = "auto"; }
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
        <span className="ai-bar-title">Describe it or paste a chat — get a draft</span>
        <span className={`ai-uses${out ? " out" : ""}`}>{usesLeft} AI use{usesLeft === 1 ? "" : "s"} left</span>
      </div>
      {out ? (
        <div className="ai-out">
          Out of free AI. <strong>Get 50 more for $5</strong> — <span style={{ color: "var(--ink-faint)" }}>coming soon.</span>
        </div>
      ) : (
        <>
          <div className="ai-bar-row">
            <textarea
              ref={taRef}
              className="ai-textarea"
              value={text}
              rows={2}
              autoFocus={autoFocus}
              placeholder={"Describe the work, or paste your whole client chat — we'll pull out the items and prices.\n\ne.g. 2h consulting at $120, a $500 setup fee, logo design $300 — for Acme, due in 30 days"}
              onChange={(e) => { setText(e.target.value); autoGrow(e.target); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); draft(); } }}
              aria-label="Describe the invoice"
            />
            <button className="btn btn-primary btn-sm" onClick={draft} disabled={busy || text.trim().length < 3}>
              {busy ? "Drafting…" : "Draft it ✨"}
            </button>
          </div>
          <div className="ai-hint">Paste a messy thread — greetings and small talk are ignored. <kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> to draft.</div>
          {error && <div className="ai-error">{error}</div>}
        </>
      )}
    </div>
  );
}
