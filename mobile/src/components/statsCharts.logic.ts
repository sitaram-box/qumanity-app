/**
 * The place-statistics charts, the parts worth testing on their own: percentages that respect the
 * website's small-count privacy rule, the colours, and the pie / donut geometry. Mirrors the web
 * dashboard (Qumanity_DPG static/js/dashboard.js: sliceFraction, pctLabel, ELEMENT_COLORS,
 * SIGN_COLORS, buildDonutSVG). Free of React / React Native imports so it can be unit-tested under
 * plain vitest (same reason as pin.logic.ts).
 *
 * Privacy (website rule): a count of 1-4 arrives as the string "<5". It is never turned into a
 * number on screen; a "<5" slice is drawn as a small wedge (size 2) and labelled "<5". When the
 * place's own total is "<5", no breakdown is shown at all.
 */

export type Count = number | string;

export const GENDER_ORDER = ['female', 'male', 'both'] as const;
export const GENDER_LABELS: Record<string, string> = { male: 'Male', female: 'Female', both: 'Third gender' };
export const GENDER_COLORS: Record<string, string> = { female: '#E85D9E', male: '#4FA3E0', both: '#B08BF0' };

export const ELEMENT_ORDER = ['Fire', 'Earth', 'Air', 'Water'] as const;
export type ElementName = (typeof ELEMENT_ORDER)[number];
export const ELEMENT_COLORS: Record<ElementName, string> = { Fire: '#FF5B45', Earth: '#5FB85C', Air: '#4FC3D9', Water: '#4A7FE0' };

/** Each element's three signs, in zodiac-wheel order. */
export const ELEMENT_SIGNS: Record<ElementName, [string, string, string]> = {
  Fire: ['Aries', 'Leo', 'Sagittarius'],
  Earth: ['Taurus', 'Virgo', 'Capricorn'],
  Air: ['Gemini', 'Libra', 'Aquarius'],
  Water: ['Cancer', 'Scorpio', 'Pisces'],
};

const SUPPRESSED_SIZE_ESTIMATE = 2;
export const isSuppressed = (v: Count | undefined) => v === '<5';

/** Share of `total` for sizing a slice or bar (0..1); never a number shown to anyone. */
export function sliceFraction(value: Count | undefined, total: Count): number {
  if (isSuppressed(total) || !total) return 0;
  const v = isSuppressed(value) ? SUPPRESSED_SIZE_ESTIMATE : Number(value ?? 0);
  return Math.max(0, v / Number(total));
}

/** "45%", or "<5" when either side is suppressed (the true figure stays unknowable). */
export function pctLabel(value: Count | undefined, total: Count): string {
  if (isSuppressed(value) || isSuppressed(total) || !total) return '<5';
  return `${Math.round((Number(value ?? 0) / Number(total)) * 100)}%`;
}

/** Sum of counts that may include "<5"; null when any part is suppressed (the sum is unknowable). */
export function sumCounts(values: (Count | undefined)[]): number | null {
  if (values.some(isSuppressed)) return null;
  return values.reduce<number>((s, v) => s + Number(v ?? 0), 0);
}

function hexToHsl(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}
function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => `0${Math.round((v + m) * 255).toString(16)}`.slice(-2);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Three related shades per element (darker / base / lighter), as the website's SIGN_COLORS. */
export const SIGN_COLORS: Record<string, string> = Object.fromEntries(
  ELEMENT_ORDER.flatMap((e) => {
    const { h, s, l } = hexToHsl(ELEMENT_COLORS[e]);
    return ELEMENT_SIGNS[e].map((sign, i) => [sign, hslToHex(h, s, Math.max(15, Math.min(85, l + [-12, 0, 14][i])))]);
  }),
);

export interface Slice {
  frac: number; // 0..1 of the full circle
  color: string;
  key: string;
}

/**
 * Donut ring arcs (website buildDonutSVG): one stroked circle per slice, each carving its own arc
 * with stroke-dasharray / -dashoffset, starting at 12 o'clock.
 */
export function donutArcs(slices: Slice[], size: number, strokeWidth: number) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return slices
    .filter((s) => s.frac > 0)
    .map((s) => {
      const len = s.frac * circumference;
      const arc = { key: s.key, color: s.color, r, dasharray: `${len} ${circumference - len}`, dashoffset: -offset };
      offset += len;
      return arc;
    });
}

/**
 * Filled pie wedges as SVG paths, starting at 12 o'clock, clockwise. Fractions are of the pie's
 * own total. A single slice covering everything is drawn as a full circle (an arc can't).
 */
export function pieWedges(slices: Slice[], size: number): { key: string; color: string; d: string | null }[] {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const total = slices.reduce((s, x) => s + Math.max(0, x.frac), 0);
  if (total <= 0) return [];
  const point = (a: number) => `${(cx + r * Math.sin(a)).toFixed(3)} ${(cy - r * Math.cos(a)).toFixed(3)}`;
  let angle = 0;
  return slices
    .filter((s) => s.frac > 0)
    .map((s) => {
      const share = s.frac / total;
      if (share >= 0.9999) return { key: s.key, color: s.color, d: null }; // full circle
      const start = angle;
      angle += share * 2 * Math.PI;
      const large = share > 0.5 ? 1 : 0;
      return { key: s.key, color: s.color, d: `M${cx} ${cy} L${point(start)} A${r} ${r} 0 ${large} 1 ${point(angle)} Z` };
    });
}
