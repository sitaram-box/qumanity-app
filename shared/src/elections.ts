/**
 * Council elections (docs/DEVELOPMENT_PLAN.md §9). Separate from post voting.
 *
 *   Village  — Lower House, 24 seats: 12 sun signs × Male/Female.
 *              Each sign's cycle runs over that sign's dates; voters and
 *              candidates are present residents of that sign and gender.
 *   Tehsil … Earth — 8 seats: 4 elements × Male/Female, elected yearly by
 *              the councils of the level below.
 */

import type { Level } from './tiers';
import { ZODIAC_RANGES, type Element } from './zodiac';

export const ELEMENTS: readonly Element[] = ['Fire', 'Earth', 'Air', 'Water'];
export const SEAT_GENDERS = ['M', 'F'] as const;

export const ELECTION_MIN_USERS: Record<Level, number> = {
  village: 100,
  tehsil: 1_000,
  district: 10_000,
  state: 100_000,
  zone: 100_000,
  country: 1_000_000,
  continent: 1_000_000,
  earth: 10_000_000,
};

export const NOMINATION_DAYS = 7;

export function electionsAllowed(level: Level, userCount: number): boolean {
  return userCount >= ELECTION_MIN_USERS[level];
}

export function houseSize(level: Level): number {
  return level === 'village' ? ZODIAC_RANGES.length * 2 : ELEMENTS.length * 2;
}

/** The sun sign whose village cycle is running on `date` (UTC calendar date). */
export function signCycleOn(date: Date): string {
  const md = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const z = ZODIAC_RANGES.find((r) =>
    r.start <= r.end ? r.start <= md && md <= r.end : md >= r.start || md <= r.end,
  );
  if (!z) throw new Error(`No sign for ${md}`);
  return z.sign;
}

/** UTC window of a sign's village cycle starting in `year`: 7 days of nomination, then voting to the end. */
export function signCycleWindow(sign: string, year: number): { start: Date; nominationEnd: Date; end: Date } {
  const z = ZODIAC_RANGES.find((r) => r.sign === sign);
  if (!z) throw new Error(`Unknown sign ${sign}`);
  const [sm, sd] = z.start.split('-').map(Number);
  const [em, ed] = z.end.split('-').map(Number);
  const start = new Date(Date.UTC(year, sm - 1, sd));
  const endYear = em < sm ? year + 1 : year; // Capricorn spans New Year
  const end = new Date(Date.UTC(endYear, em - 1, ed, 23, 59, 59));
  const nominationEnd = new Date(start.getTime() + NOMINATION_DAYS * 24 * 60 * 60 * 1000);
  return { start, nominationEnd, end };
}

export interface Resident {
  gender: 'M' | 'F' | 'O';
  zodiac_type: string;
  age_type: 'B' | 'Y' | 'V' | 'S';
}

/** Village seat (sign, gender): may this resident vote for it? "Other" votes for either seat. */
export function canVoteVillageSeat(r: Resident, sign: string, seatGender: 'M' | 'F'): boolean {
  return r.zodiac_type === sign && (r.gender === seatGender || r.gender === 'O');
}

/** Village seat candidates: same sign and gender, Yuvak age (website rule). */
export function canStandVillageSeat(r: Resident, sign: string, seatGender: 'M' | 'F'): boolean {
  return r.zodiac_type === sign && r.gender === seatGender && r.age_type === 'Y';
}
