/**
 * Qumanity identifiers (docs/DEVELOPMENT_PLAN.md §4).
 *
 *   User ID    — 9 random digits. Private ID: birth location, fixed for life.
 *   Account ID — 10 random digits. Public ID: present location; a new one per move.
 *   Group ID   — 9 random digits, one per location group / personal group.
 *
 * Each number points to a hidden readable ID kept in server-only records:
 *   RM-0042-GM-AY-FL-CS.DL.5.4.1E
 *   initials - serial - gender - age - zodiac - location
 * Codes follow the website (Desktop/Qumanity/identity_core.py).
 *
 * Randomness is injectable: Cloud Functions pass a crypto source, tests pass
 * a fixed one. Numbers are only ever minted server-side.
 */

import { getZodiacSign, type ZodiacRange } from './zodiac';

export type RandomInt = (maxExclusive: number) => number;

export const defaultRandomInt: RandomInt = (max) => Math.floor(Math.random() * max);

// ---- numeric IDs ------------------------------------------------------------

export const USER_ID_DIGITS = 9;
export const ACCOUNT_ID_DIGITS = 10;
export const GROUP_ID_DIGITS = 9;

/** Random number of `digits` digits, never starting with 0. */
export function randomDigits(digits: number, rand: RandomInt = defaultRandomInt): string {
  let out = String(1 + rand(9));
  for (let i = 1; i < digits; i++) out += String(rand(10));
  return out;
}

export const newUserId = (rand?: RandomInt) => randomDigits(USER_ID_DIGITS, rand);
export const newAccountId = (rand?: RandomInt) => randomDigits(ACCOUNT_ID_DIGITS, rand);
export const newGroupId = (rand?: RandomInt) => randomDigits(GROUP_ID_DIGITS, rand);

export const isUserId = (v: string) => /^[1-9]\d{8}$/.test(v);
export const isAccountId = (v: string) => /^[1-9]\d{9}$/.test(v);
export const isGroupId = isUserId;

/** Display form: 482 915 307 (9) · 7310 042 285 (10). */
export function formatId(id: string): string {
  if (isAccountId(id)) return `${id.slice(0, 4)} ${id.slice(4, 7)} ${id.slice(7)}`;
  if (isUserId(id)) return `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6)}`;
  return id;
}

/** Strip spaces/dashes a person may type when searching an Account ID. */
export function normalizeIdInput(value: string): string {
  return value.replace(/[\s-]/g, '');
}

// ---- readable (hidden) ID parts --------------------------------------------

export type Gender = 'M' | 'F' | 'O';
export type AgeType = 'B' | 'Y' | 'V' | 'S';

export const AGE_TYPE_NAMES: Record<AgeType, string> = {
  B: 'Balak',
  Y: 'Yuvak',
  V: 'Vridh',
  S: 'Sanyas',
};

/** Element letter + sign letter, as on the website. */
export const ZODIAC_CODES: Record<string, string> = {
  Aries: 'FA',
  Taurus: 'ET',
  Gemini: 'AG',
  Cancer: 'WC',
  Leo: 'FL',
  Virgo: 'EV',
  Libra: 'AL',
  Scorpio: 'WS',
  Sagittarius: 'FS',
  Capricorn: 'EC',
  Aquarius: 'AA',
  Pisces: 'WP',
};

export function isGender(v: unknown): v is Gender {
  return v === 'M' || v === 'F' || v === 'O';
}

export function ageInYears(dob: string, asOf: string): number {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ay, am, ad] = asOf.split('-').map(Number);
  return ay - by - (am < bm || (am === bm && ad < bd) ? 1 : 0);
}

/** Balak 0–24, Yuvak 25–49, Vridh 50–75, Sanyas 76+. */
export function ageType(dob: string, asOf: string): AgeType {
  const age = ageInYears(dob, asOf);
  if (age <= 24) return 'B';
  if (age <= 49) return 'Y';
  if (age <= 75) return 'V';
  return 'S';
}

export function nameInitials(name: string | null | undefined): string {
  const parts = (name ?? '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'XX';
  const first = Array.from(parts[0])[0].toUpperCase();
  const lastWord = Array.from(parts.length > 1 ? parts[parts.length - 1] : parts[0]);
  const last = (parts.length > 1 ? lastWord[0] : lastWord[lastWord.length - 1]).toUpperCase();
  return first + last;
}

export function serialCode(serial: number): string {
  if (!Number.isInteger(serial) || serial < 1) throw new Error(`Invalid serial: ${serial}`);
  return String(serial).padStart(4, '0');
}

export interface PersonCodes {
  initials: string;
  gender: Gender;
  age_type: AgeType;
  zodiac_type: string; // sign name, e.g. "Leo"
  zodiac_code: string; // e.g. "FL"
  element: ZodiacRange['element'];
}

/** Everything that is frozen at registration, derived from the profile. */
export function personCodes(p: { name: string; gender: Gender; dob: string }, asOf: string): PersonCodes {
  const z = getZodiacSign(p.dob);
  if (!z) throw new Error(`No zodiac sign for ${p.dob}`);
  return {
    initials: nameInitials(p.name),
    gender: p.gender,
    age_type: ageType(p.dob, asOf),
    zodiac_type: z.sign,
    zodiac_code: ZODIAC_CODES[z.sign],
    element: z.element,
  };
}

/** RM-0042-GM-AY-FL-CS.DL.5.4.1E */
export function readableId(codes: PersonCodes, serial: number, locationId: string): string {
  return [codes.initials, serialCode(serial), `G${codes.gender}`, `A${codes.age_type}`, codes.zodiac_code, locationId].join('-');
}

export interface ParsedReadableId {
  initials: string;
  serial: number;
  gender: Gender;
  age_type: AgeType;
  zodiac_code: string;
  location_id: string;
}

const READABLE_RE = /^([^-]{2})-(\d{4,})-G([MFO])-A([BYVS])-([FEAW][A-Z])-(.+)$/u;

export function parseReadableId(id: string): ParsedReadableId | null {
  const m = READABLE_RE.exec(id);
  if (!m) return null;
  return {
    initials: m[1],
    serial: Number(m[2]),
    gender: m[3] as Gender,
    age_type: m[4] as AgeType,
    zodiac_code: m[5],
    location_id: m[6],
  };
}
