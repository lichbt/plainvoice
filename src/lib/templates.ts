// Invoice templates (Spec §5: "3–5 clean templates with logo + accent color").
// Each is a shared config the live preview AND the PDF read, so they never diverge.
// Templates are framed by business type but really differ in header style, font, accent.

export type HeaderStyle = "plain" | "band" | "minimal";

export interface Template {
  id: string;
  label: string;
  blurb: string; // the "business type" framing
  headerStyle: HeaderStyle;
  font: "serif" | "sans";
  accent: string; // default accent hex; user can override per invoice
}

export const TEMPLATES: Template[] = [
  { id: "classic", label: "Classic", blurb: "Freelancers & consultants", headerStyle: "plain", font: "sans", accent: "#533AFD" },
  { id: "modern", label: "Modern", blurb: "Agencies & studios", headerStyle: "band", font: "sans", accent: "#1C1E54" },
  { id: "minimal", label: "Minimal", blurb: "Designers & writers", headerStyle: "minimal", font: "sans", accent: "#0D253D" },
  { id: "trades", label: "Trades", blurb: "Contractors & trades", headerStyle: "band", font: "sans", accent: "#EA2261" },
];

export const DEFAULT_TEMPLATE = TEMPLATES[0];

// Accent swatches offered in the picker (Stripe palette).
export const ACCENTS = ["#533AFD", "#1C1E54", "#1E4F6B", "#EA2261", "#9C5A1F", "#0D253D"];

export function getTemplate(id?: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;
}

/** Resolve the accent to use: explicit override, else the template's default. */
export function resolveAccent(template: Template, override?: string): string {
  return override || template.accent;
}

/** A readable on-accent text color (white for dark accents). All our accents are dark. */
export const ON_ACCENT = "#FBF8F0";
