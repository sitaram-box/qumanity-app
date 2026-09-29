/**
 * Timelines, group modes and posting permissions (docs/DEVELOPMENT_PLAN.md §1, §7).
 *
 *   Private  — one-to-one chats and requests (no groups)
 *   Personal — Family, Friends (max 2, owned by the user)
 *   Public   — Village, Tehsil, District, State, Zone
 *   Global   — Country, Continent, Earth
 *
 * Chat box / new posts:
 *   Village              open           every present resident
 *   District             social_workers approved Social Workers + council
 *   everything else      council        council (admin) only
 *   Family / Friends     open           all members
 */

import type { Level } from './tiers';
import { tierLabel } from './tiers';

export type Timeline = 'private' | 'personal' | 'public' | 'global';
export type GroupMode = 'open' | 'social_workers' | 'council';
export type PersonalKind = 'family' | 'friends';

export const PUBLIC_LEVELS: readonly Level[] = ['village', 'tehsil', 'district', 'state', 'zone'];
export const GLOBAL_LEVELS: readonly Level[] = ['country', 'continent', 'earth'];

export const PERSONAL_KINDS: readonly PersonalKind[] = ['family', 'friends'];
export const MAX_PERSONAL_GROUPS = PERSONAL_KINDS.length;
export const MAX_PERSONAL_GROUP_MEMBERS = 256;

export const COUNCIL_SEATS = [
  { seat: 1, title: 'Mentor', method: 'appointed' },
  { seat: 2, title: 'Member 2', method: 'elected' },
  { seat: 3, title: 'Member 3', method: 'elected' },
  { seat: 4, title: 'Member 4', method: 'elected' },
  { seat: 5, title: 'Member 5', method: 'hired' },
] as const;

export function timelineForLevel(level: Level): Timeline {
  return GLOBAL_LEVELS.includes(level) ? 'global' : 'public';
}

export function modeForLevel(level: Level): GroupMode {
  if (level === 'village') return 'open';
  if (level === 'district') return 'social_workers';
  return 'council';
}

/** Whether a location of this level/country gets its own group (hidden tiers do not). */
export function hasGroup(countryCode: string, level: Level): boolean {
  return tierLabel(countryCode, level) !== null;
}

export function publicGroupName(locationName: string, countryCode: string, level: Level): string {
  const label = tierLabel(countryCode, level);
  const repeats = !!label && locationName.toLowerCase().endsWith(label.toLowerCase());
  return level === 'earth' || !label || repeats ? `${locationName} Group` : `${locationName} ${label} Group`;
}

export interface Poster {
  isResident: boolean;
  isCouncil: boolean;
  isSocialWorker: boolean;
}

/** Can this person write in the chat box / create a new post in a group of this mode? */
export function canPost(mode: GroupMode, who: Poster, isActive = true): boolean {
  if (!isActive) return false;
  if (who.isCouncil) return true;
  if (!who.isResident) return false;
  if (mode === 'open') return true;
  if (mode === 'social_workers') return who.isSocialWorker;
  return false;
}

/** A group is active while at least one council seat is filled. */
export function isGroupActive(councilIds: readonly string[]): boolean {
  return councilIds.length > 0;
}

/** Deterministic id for a private chat between two Account IDs. */
export function privateChatId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export type RequestType = 'friend' | 'family' | 'message';
export type RequestStatus = 'pending' | 'waiting' | 'accepted' | 'declined';
