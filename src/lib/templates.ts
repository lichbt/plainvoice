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
  { id: "classic", label: "Classic", blurb: "Freelancers & consultants", headerStyle: "plain", font: "serif", accent: "#1E5B41" },
  { id: "modern", label: "Modern", blurb: "Agencies & studios", headerStyle: "band", font: "sans", accent: "#1E4F6B" },
  { id: "minimal", label: "Minimal", blurb: "Designers & writers", headerStyle: "minimal", font: "sans", accent: "#211F18" },
  { id: "trades", label: "Trades", blurb: "Contractors & trades", headerStyle: "band", font: "serif", accent: "#9C5A1F" },
];

export const DEFAULT_TEMPLATE = TEMPLATES[0];

// Accent swatches offered in the picker.
export const ACCENTS = ["#1E5B41", "#1E4F6B", "#6B2D5B", "#9C5A1F", "#9A382C", "#211F18"];

export function getTemplate(id?: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;
}

/** Resolve the accent to use: explicit override, else the template's default. */
export function resolveAccent(template: Template, override?: string): string {
  return override || template.accent;
}

/** A readable on-accent text color (white for dark accents). All our accents are dark. */
export const ON_ACCENT = "#FBF8F0";
