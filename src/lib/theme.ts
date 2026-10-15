import type { CSSProperties } from "react";

// Per-wedding colors. Couples pick a palette (or custom colors); everything brand-colored
// in the UI derives from two values, with text colors chosen for WCAG contrast.

export type Palette = { id: string; name: string; primary: string; accent: string };

export const PALETTES: Palette[] = [
  { id: "coral", name: "Coral pop", primary: "#FF6B5B", accent: "#FFC93C" },
  { id: "blush", name: "Blush & gold", primary: "#E8879B", accent: "#D4A84B" },
  { id: "sage", name: "Sage garden", primary: "#7A9E7E", accent: "#F2C14E" },
  { id: "dusty-blue", name: "Dusty blue", primary: "#5B7FA6", accent: "#F2B5C0" },
  { id: "terracotta", name: "Terracotta", primary: "#C8553D", accent: "#F2CC8F" },
  { id: "lavender", name: "Lavender", primary: "#8E7DBE", accent: "#FFD6A5" },
  { id: "emerald", name: "Emerald & gold", primary: "#1F7A5C", accent: "#D4AF37" },
  { id: "burgundy", name: "Burgundy", primary: "#8C1C3A", accent: "#E8A598" },
  { id: "midnight", name: "Midnight", primary: "#22304A", accent: "#C9A15B" },
];

export const DEFAULT_PALETTE = PALETTES[0];

const HEX_RE = /^#?([0-9a-f]{6})$/i;
const INK = "#1F1F23";
const WHITE = "#FFFFFF";

export function normalizeHex(value: string | null | undefined): string | null {
  const m = value?.trim().match(HEX_RE);
  return m ? `#${m[1].toUpperCase()}` : null;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: number[]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Text color (charcoal or white) that reads best on `bg`. */
export function readableOn(bg: string) {
  return contrast(bg, INK) >= contrast(bg, WHITE) ? INK : WHITE;
}

/** A darker shade of `hex` usable as text on white (contrast >= 4.5). */
export function inkOf(hex: string) {
  let c = rgb(hex);
  for (let i = 0; i < 20 && contrast(toHex(c), WHITE) < 4.5; i++) c = c.map((v) => v * 0.88) as typeof c;
  return toHex(c);
}

/** CSS variables for a wedding's colors; apply as `style` on a wrapper element. */
export function themeVars(primary?: string | null, accent?: string | null): CSSProperties {
  const p = normalizeHex(primary) ?? DEFAULT_PALETTE.primary;
  const a = normalizeHex(accent) ?? DEFAULT_PALETTE.accent;
  return {
    "--brand": p,
    "--brand-foreground": readableOn(p),
    "--brand-ink": inkOf(p),
    "--pop": a,
    "--pop-foreground": readableOn(a),
    // Tokens that derive from --brand are resolved where they're declared (:root), so a themed
    // wrapper has to restate them for buttons and focus rings inside it to pick up the colors.
    "--primary": p,
    "--primary-foreground": readableOn(p),
    "--ring": p,
  } as CSSProperties;
}
