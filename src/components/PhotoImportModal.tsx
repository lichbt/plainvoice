import { useRef, useState } from "react";
import { useEscape } from "../lib/useEscape";
import { recognizeInvoice, type OcrLine } from "../lib/ocr";
import { downscaleImage } from "../lib/imagePrep";
import { parseAiDraft, type AiInvoiceDraft } from "../lib/aiInvoice";

// Photo import, two reads:
//  · FREE — on-device OCR (Tesseract). The image never leaves the device.
//  · AI (1 use) — sends the downscaled PHOTO to a vision model, which reads
//    layout / messy receipts / handwriting far better than OCR. The user is told
//    the photo is sent before they choose it.
export function PhotoImportModal({
  onClose,
  onResult,
  onAiDraft,
  usesLeft,
  knownClients,
  defaultCurrency,
}: {
  onClose: () => void;
  onResult: (lines: OcrLine[]) => void;
  onAiDraft: (draft: AiInvoiceDraft) => void;
  usesLeft: number;
  knownClients: string[];
  defaultCurrency: string;
}) {
  const [status, setStatus] = useState("Choose or snap a printed invoice.");
  const [scanning, setScanning] = useState(false);
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState<"pick" | "done">("pick");
  const [ocrLines, setOcrLines] = useState<OcrLine[]>([]);
  const [imageData, setImageData] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const outOfUses = usesLeft <= 0;
  useEscape(onClose, !scanning && !aiBusy);

  async function run(file: File) {
    setScanning(true); setError(null); setOcrLines([]); setImageData(""); setStatus("Preparing photo…");
    // shrink the image for the (optional) AI read; fail-soft — OCR still works
    try { setImageData(await downscaleImage(file)); } catch { /* ignore */ }
    setStatus("Reading on your device…");
    try {
      const res = await recognizeInvoice(file, (p) => { setPct(p); setStatus(`Reading on your device… ${p}%`); });
      setScanning(false);
      setOcrLines(res.lines);
      setPhase("done");
      setStatus(res.lines.length
        ? `Read ${res.lines.length} item${res.lines.length > 1 ? "s" : ""} on-device. For best results, read with AI.`
        : "Couldn't pick out items on-device — read with AI for a clean draft.");
    } catch {
      setScanning(false);
      // OCR failed, but if we still have the image the AI read can carry it
      if (imageData) { setPhase("done"); setStatus("Couldn't read it on-device — try reading with AI."); }
      else setStatus("Something went wrong with that image. Please try another.");
    }
  }

  async function readWithAI() {
    if (!imageData || aiBusy) return;
    setAiBusy(true); setError(null);
    try {
      const res = await fetch("/api/ai/parse-invoice-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: imageData, knownClients, defaultCurrency }),
      });
      if (res.status === 503) { setError("AI isn't switched on yet — use the free read below."); return; }
      if (res.status === 413) { setError("That photo's too large — try another."); return; }
      if (!res.ok) { setError("Couldn't read it with AI — use the free read, or try again."); return; }
      const draft = parseAiDraft((await res.json())?.draft);
      if (draft.lines.length === 0) { setError("AI couldn't find line items — try a clearer photo or the free read."); return; }
      onAiDraft(draft); // parent maps it in + spends one use
      onClose();
    } catch {
      setError("Network hiccup — try again, or use the free read.");
    } finally {
      setAiBusy(false);
    }
  }

  const useFree = () => { if (ocrLines.length) onResult(ocrLines); };
  const pick = () => fileRef.current?.click();

  return (
    <div className="overlay" onClick={scanning || aiBusy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!scanning && !aiBusy && <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>}
        <h3>Load from a photo</h3>
        <p className="m-lead">Snap a printed invoice and we rebuild it as an editable draft. The free read happens <strong>on your device</strong>; reading with AI sends the photo for the best result (messy receipts, handwriting).</p>

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
            {scanning ? `Reading… ${pct}%` : "Choose invoice photo"}
          </button>
        ) : (
          <>
            {!outOfUses && imageData && (
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={aiBusy} onClick={readWithAI}>
                {aiBusy ? "Reading the photo with AI…" : "✨ Read with AI · 1 use"}
              </button>
            )}
            <div className="photo-alt">
              {ocrLines.length ? (
                <button type="button" className="link-btn" onClick={useFree}>Use {ocrLines.length} item{ocrLines.length > 1 ? "s" : ""} as-is (free)</button>
              ) : (
                <span style={{ color: "var(--ink-faint)" }}>No clean items found on-device.</span>
              )}
              <button type="button" className="link-btn" onClick={pick}>Choose another photo</button>
            </div>
            {outOfUses && <div style={{ fontSize: ".78rem", color: "var(--ink-faint)", marginTop: ".5rem", textAlign: "center" }}>Out of AI uses — using the free read, or top up first.</div>}
            {error && <div className="ai-error">{error}</div>}
          </>
        )}

        <div style={{ fontSize: ".76rem", color: "var(--ink-faint)", marginTop: ".9rem", textAlign: "center" }}>
          Free read = on your device. AI read sends the (downscaled) photo to read it.
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
