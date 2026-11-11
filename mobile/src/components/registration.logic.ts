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

/** Shown under the chips; the website's own hint. Any saved value — "Prefer not to say" too — is locked. */
export const RELIGION_HINT = 'Kept private to your account. This is a one-time choice — changing it later needs an Admin request.';

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
