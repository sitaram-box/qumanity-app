/**
 * Tropical Sun sign + element from date of birth alone.
 * Port of Qumanity_DPG/zodiac_core.py get_zodiac_sign() and ZODIAC_RANGES.
 * The element drives the ID's element code and village governance cycles.
 */

export type Element = 'Fire' | 'Earth' | 'Air' | 'Water';

export interface ZodiacRange {
  sign: string;
  element: Element;
  start: string; // MM-DD
  end: string; // MM-DD
}

export const ZODIAC_RANGES: readonly ZodiacRange[] = [
  { sign: 'Aries', element: 'Fire', start: '03-21', end: '04-19' },
  { sign: 'Taurus', element: 'Earth', start: '04-20', end: '05-20' },
  { sign: 'Gemini', element: 'Air', start: '05-21', end: '06-20' },
  { sign: 'Cancer', element: 'Water', start: '06-21', end: '07-22' },
  { sign: 'Leo', element: 'Fire', start: '07-23', end: '08-22' },
  { sign: 'Virgo', element: 'Earth', start: '08-23', end: '09-22' },
  { sign: 'Libra', element: 'Air', start: '09-23', end: '10-22' },
  { sign: 'Scorpio', element: 'Water', start: '10-23', end: '11-21' },
  { sign: 'Sagittarius', element: 'Fire', start: '11-22', end: '12-21' },
  { sign: 'Capricorn', element: 'Earth', start: '12-22', end: '01-19' },
  { sign: 'Aquarius', element: 'Air', start: '01-20', end: '02-18' },
  { sign: 'Pisces', element: 'Water', start: '02-19', end: '03-20' },
];

/** `dob` is an ISO date string (YYYY-MM-DD). */
export function getZodiacSign(dob: string): ZodiacRange | null {
  const md = parseIsoDate(dob).slice(5); // "MM-DD"
  for (const z of ZODIAC_RANGES) {
    if (z.start <= z.end) {
      if (z.start <= md && md <= z.end) return z;
    } else if (md >= z.start || md <= z.end) {
      // Capricorn wraps New Year (12-22 .. 01-19)
      return z;
    }
  }
  return null;
}

export function parseIsoDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid ISO date: ${value}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return value;
}
