// QR code generation for the payment link — shown on the invoice so clients can
// scan to pay. Produces a PNG data URL usable by both the React preview (<img>)
// and the PDF (pdf-lib embedPng).
import QRCode from "qrcode";

const INK = "#211F18";

export function qrDataUrl(text: string, size = 220): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: INK, light: "#FFFFFF" },
  });
}
