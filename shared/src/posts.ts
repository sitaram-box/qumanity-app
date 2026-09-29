/**
 * Tiered posts: vote → elevate / freeze / remove (docs/DEVELOPMENT_PLAN.md §8).
 */

import type { Level } from './tiers';

export const POST_LEVELS: readonly Level[] = [
  'village', 'tehsil', 'district', 'state', 'zone', 'country', 'continent', 'earth',
];

/** Voting days and elevation threshold per level. Earth never elevates. */
export const POST_RULES: Record<Level, { days: number; threshold: number }> = {
  village: { days: 7, threshold: 10 },
  tehsil: { days: 8, threshold: 100 },
  district: { days: 9, threshold: 1_000 },
  state: { days: 10, threshold: 10_000 },
  zone: { days: 11, threshold: 100_000 },
  country: { days: 12, threshold: 1_000_000 },
  continent: { days: 13, threshold: 10_000_000 },
  earth: { days: 14, threshold: 100_000_000 },
};

/** Score shards per level, sized for the expected vote rate (≈1 write/sec per doc). */
export const SCORE_SHARDS: Record<Level, number> = {
  village: 1, tehsil: 1, district: 2, state: 10, zone: 20, country: 50, continent: 100, earth: 200,
};

export type PostStatus = 'active' | 'frozen' | 'elevated' | 'removed';
export type PostOutcome = 'elevate' | 'freeze' | 'remove';

export type Vote = -1 | 0 | 1;
export const isVote = (v: unknown): v is Vote => v === -1 || v === 0 || v === 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export function votingEnd(level: Level, start: Date): Date {
  return new Date(start.getTime() + POST_RULES[level].days * DAY_MS);
}

/** What happens when voting closes. Earth posts that pass the threshold freeze with honour. */
export function outcomeFor(level: Level, score: number): PostOutcome {
  if (score <= 0) return 'remove';
  if (level !== 'earth' && score >= POST_RULES[level].threshold) return 'elevate';
  return 'freeze';
}

export function isEarthHonour(level: Level, score: number): boolean {
  return level === 'earth' && score >= POST_RULES.earth.threshold;
}

/** Comments exist only once voting is finished. */
export function commentsOpen(status: PostStatus): boolean {
  return status === 'frozen' || status === 'elevated';
}
