/**
 * Registration fields added to match the website (2026-11-12): optional Spiritual path
 * (`religion_belief`) and "I don't remember my exact birth time" (`tob_unknown`). Kept free of
 * React / React Native imports so they can be unit-tested under plain vitest (same reason as
 * pin.logic.ts). The server stays the authority for both.
 */

/** Server values: RELIGION_BELIEF_VALUES in Qumanity_DPG/app.py. Labels as on the website's register page. */
export const RELIGIONS = [
  { value: 'hindu', label: 'Hindu' },
  { value: 'christian', label: 'Christian' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'sikh', label: 'Sikh' },
  { value: 'buddhist', label: 'Buddhist' },
  { value: 'jain', label: 'Jain' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

/** '' = not answered (nothing is sent, the server stores NULL and the member can answer later). */
export type Religion = (typeof RELIGIONS)[number]['value'] | '';

export function religionLabel(religion: Religion): string | null {
  return RELIGIONS.find((r) => r.value === religion)?.label ?? null;
}

/**
 * Birth-time part of the registration body. When the time is unknown no time is sent: the server
 * discards any tob, stores 12:00 and sets birth_time_known = 0 (Admin can correct it later).
 */
export function birthTimeFields(tob: string, tobUnknown: boolean): { tob?: string; tob_unknown?: true } {
  return tobUnknown ? { tob_unknown: true } : { tob };
}

/** Optional religion: omitted when not answered, so the server stores NULL (not locked). */
export function religionFields(religion: Religion): { religion_belief?: string } {
  return religion ? { religion_belief: religion } : {};
}

/**
 * Time of birth on a 12-hour clock (hour 1-12, minute, AM/PM) → the website's 24-hour "HH:MM".
 * 12 AM is midnight (00:MM), 12 PM is noon (12:MM). null while incomplete or out of range.
 */
export function to24h(hour: string, minute: string, period: 'AM' | 'PM' | null): string | null {
  const h = Number(hour);
  const m = Number(minute);
  if (!period || hour === '' || minute === '' || !Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  const h24 = (h % 12) + (period === 'PM' ? 12 : 0);
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The website's "HH:MM" back onto a 12-hour clock, to refill the form (e.g. after Back). */
export function from24h(tob: string): { hour: string; minute: string; period: 'AM' | 'PM' | null } {
  const m = /^(\d{2}):(\d{2})$/.exec(tob);
  if (!m) return { hour: '', minute: '', period: null };
  const h = Number(m[1]);
  return { hour: String(h % 12 === 0 ? 12 : h % 12), minute: m[2], period: h < 12 ? 'AM' : 'PM' };
}
