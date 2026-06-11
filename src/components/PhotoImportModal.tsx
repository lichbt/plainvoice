import { useRef, useState } from "react";
import { recognizeInvoice, type OcrLine } from "../lib/ocr";
import { parseAiDraft, type AiInvoiceDraft } from "../lib/aiInvoice";

// Photo import. Step 1: free on-device OCR (Tesseract) — the image never leaves
// the device. Step 2 (optional, 1 AI use): send the OCR *text* to the AI to
// structure it into clean line items — far better than the regex fallback, and
// still private (only text is sent, not the photo).
export function PhotoImportModal({
  onClose,
  onResult,
  onAiDraft,
  usesLeft,
  knownClients,
  defaultCurrency,
}: {
  onClose: () => void;
  onResult: (lines: OcrLine[]) => void;          // free path: apply regex-parsed lines
  onAiDraft: (draft: AiInvoiceDraft) => void;    // AI path: apply structured draft (parent spends a use)
  usesLeft: number;
  knownClients: string[];
  defaultCurrency: string;
}) {
  const [status, setStatus] = useState("Choose or snap a printed invoice — we read it on your device.");
  const [scanning, setScanning] = useState(false);
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState<"pick" | "done">("pick");
  const [ocr, setOcr] = useState<{ lines: OcrLine[]; rawText: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const outOfUses = usesLeft <= 0;

  async function run(file: File) {
    setScanning(true); setError(null); setStatus("Reading on your device…");
    try {
      const res = await recognizeInvoice(file, (p) => { setPct(p); setStatus(`Reading on your device… ${p}%`); });
      setScanning(false);
      if (!res.rawText.trim()) { setStatus("Couldn't read that image — try a clearer, brighter photo."); return; }
      setOcr(res);
      setPhase("done");
      setStatus(res.lines.length
        ? `Read ${res.lines.length} item${res.lines.length > 1 ? "s" : ""}. Let AI clean it up, or use as-is.`
        : "Read the text — let AI pull out the line items.");
    } catch {
      setScanning(false);
      setStatus("Something went wrong reading that image. Please try another.");
    }
  }

  async function readWithAI() {
    if (!ocr || aiBusy) return;
    setAiBusy(true); setError(null);
    try {
      const res = await fetch("/api/ai/parse-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: ocr.rawText.slice(0, 8000), knownClients, defaultCurrency }),
      });
      if (res.status === 503) { setError("AI isn't switched on yet — use the free read below."); return; }
      if (res.status === 413) { setError("That invoice has a lot of text — use the free read below."); return; }
      if (!res.ok) { setError("Couldn't read it with AI — use the free read, or try again."); return; }
      const draft = parseAiDraft((await res.json())?.draft);
      if (draft.lines.length === 0) { setError("AI didn't find clear line items — use the free read below."); return; }
      onAiDraft(draft); // parent maps it in + spends one use
      onClose();
    } catch {
      setError("Network hiccup — try again, or use the free read.");
    } finally {
      setAiBusy(false);
    }
  }

  const useFree = () => { if (ocr?.lines.length) { onResult(ocr.lines); } };
  const pick = () => fileRef.current?.click();

  return (
    <div className="overlay" onClick={scanning || aiBusy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!scanning && !aiBusy && <button className="x" onClick={onClose} aria-label="Close">×</button>}
        <h3>Load from a photo</h3>
        <p className="m-lead">Snap a printed invoice and we rebuild it as an editable draft. The photo is read <strong>on your device</strong> — only the text is ever sent, and only if you choose AI.</p>

        <div className={`scan-stage${scanning ? " scanning" : ""}`} style={scanStageStyle}>
          <div className="scan-line" style={scanLineStyle(scanning)} />
          <div style={scanDocStyle}>
            {[60, 80, 45, 70, 50].map((w, i) => (
              <div key={i} style={{ height: 7, background: "#d9cfb6", borderRadius: 4, marginBottom: 8, width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div style={{ fontSize: ".88rem", color: "var(--ink-soft)", margin: "1rem 0", textAlign: "center", minHeight: "1.3em" }}>{status}</div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); }} />

        {phase === "pick" ? (
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={scanning} onClick={pick}>
            {scanning ? `Scanning… ${pct}%` : "Choose invoice photo (free)"}
          </button>
        ) : (
          <>
            {!outOfUses && (
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={aiBusy} onClick={readWithAI}>
                {aiBusy ? "Reading with AI…" : "✨ Read with AI · 1 use"}
              </button>
            )}
            <div className="photo-alt">
              {ocr?.lines.length ? (
                <button type="button" className="link-btn" onClick={useFree}>Use {ocr.lines.length} item{ocr.lines.length > 1 ? "s" : ""} as-is (free)</button>
              ) : (
                <span style={{ color: "var(--ink-faint)" }}>No clean items found — AI reads it best.</span>
              )}
              <button type="button" className="link-btn" onClick={pick}>Choose another photo</button>
            </div>
            {outOfUses && <div style={{ fontSize: ".78rem", color: "var(--ink-faint)", marginTop: ".5rem", textAlign: "center" }}>Out of AI uses — using the free read, or top up first.</div>}
            {error && <div className="ai-error">{error}</div>}
          </>
        )}

        <div style={{ fontSize: ".76rem", color: "var(--ink-faint)", marginTop: ".9rem", textAlign: "center" }}>
          Handwriting &amp; very messy receipts read best with AI vision — coming in a later build.
        </div>
      </div>
    </div>
  );
}

const scanStageStyle: React.CSSProperties = {
  position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)",
  background: "#2a2519", aspectRatio: "4 / 3", display: "grid", placeItems: "center",
};
const scanDocStyle: React.CSSProperties = {
  width: "74%", background: "#f7f3ea", borderRadius: 6, padding: "1rem 1.1rem",
  transform: "rotate(-1deg)", boxShadow: "0 10px 30px rgba(0,0,0,.4)",
};
const scanLineStyle = (on: boolean): React.CSSProperties => ({
  position: "absolute", left: 0, right: 0, height: 3,
  background: "linear-gradient(90deg,transparent,var(--accent-2),transparent)",
  boxShadow: "0 0 16px 3px rgba(44,124,88,.7)",
  opacity: on ? 1 : 0, animation: on ? "scan 1.7s ease-in-out infinite" : "none",
});
