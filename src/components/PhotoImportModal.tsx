import { useRef, useState } from "react";
import { recognizeInvoice, type OcrLine } from "../lib/ocr";

// Free, on-device OCR of a printed invoice. Result lands as an editable draft.
export function PhotoImportModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (lines: OcrLine[]) => void;
}) {
  const [status, setStatus] = useState("Choose or snap a printed invoice — we read it on your device.");
  const [scanning, setScanning] = useState(false);
  const [pct, setPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(file: File) {
    setScanning(true);
    setStatus("Reading on your device…");
    try {
      const { lines } = await recognizeInvoice(file, (p) => { setPct(p); setStatus(`Reading on your device… ${p}%`); });
      if (lines.length === 0) {
        setStatus("Couldn't find line items — try a clearer photo, or add them by hand.");
        setScanning(false);
        return;
      }
      setStatus(`Found ${lines.length} line item${lines.length > 1 ? "s" : ""}.`);
      onResult(lines);
    } catch {
      setStatus("Something went wrong reading that image. Please try another.");
      setScanning(false);
    }
  }

  return (
    <div className="overlay" onClick={scanning ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!scanning && <button className="x" onClick={onClose} aria-label="Close">×</button>}
        <h3>Load from a photo</h3>
        <p className="m-lead">We rebuild a printed invoice as an editable draft. Reads on your device, free, no account.</p>

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
        <div style={{ display: "flex", gap: ".6rem" }}>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={scanning} onClick={() => fileRef.current?.click()}>
            {scanning ? `Scanning… ${pct}%` : "Choose invoice photo (free)"}
          </button>
        </div>
        <div style={{ fontSize: ".76rem", color: "var(--ink-faint)", marginTop: ".9rem", textAlign: "center" }}>
          Handwriting or messy receipts read better with AI vision — coming in a later build.
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
