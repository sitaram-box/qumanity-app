/**
 * Q-Punch cascade election (Tehsil and up), the parts worth testing on their own: the element
 * rotation, the Head line, and which of the member's chosen seats still need a vote. Free of
 * React / React Native imports so it can be unit-tested under plain vitest (same reason as
 * pin.logic.ts). Mirrors the website's own board.js (cascadeElectionBlock).
 */

import type { CascadeStatus, Element } from '@/api/qumanity';

export const ELEMENTS: Element[] = ['Fire', 'Earth', 'Air', 'Water'];
export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];
export const ELEMENT_EMOJI: Record<Element, string> = { Fire: '🔥', Earth: '🌱', Air: '🌬️', Water: '💧' };

/** Where an element sits in the quarterly rotation relative to the one leading now (website labels). */
export function rotationLabel(element: Element, active: Element | null): string {
  if (!active || element === active) return active ? 'Leading now' : '';
  const diff = (((ELEMENTS.indexOf(element) - ELEMENTS.indexOf(active)) % 4) + 4) % 4;
  return ({ 1: 'Next quarter', 2: 'Upcoming', 3: 'Just finished' } as Record<number, string>)[diff] ?? '';
}

type Council = NonNullable<CascadeStatus['council']>;

/** The Head line under the leading element, in the website's words. */
export function headLine(c: Council): string | null {
  const lead = c.active_element ? c.members[c.active_element] : null;
  if (c.head_user_id && lead) {
    const head = c.head_gender === 'male' ? lead.male : lead.female;
    const name = head?.name ?? 'The leader';
    return c.head_gender === 'male'
      ? `🏆 ${name} is the official Head — approved by 51%+ of the Upper House.`
      : `⚡ ${name} holds the Head role with exceptional powers — the Male did not reach 51% Upper House approval this quarter.`;
  }
  if (c.approval) return `Head approval voting is open until ${c.approval.approval_end} — the Upper House is deciding whether the Male leads officially.`;
  return null;
}

/** The Male the Upper House is approving (or not) as official Head. */
export function approvalCandidateName(c: Council): string {
  const lead = c.active_element ? c.members[c.active_element] : null;
  return lead?.male?.name ?? 'the Male candidate';
}

export type SeatKey = `${Element}:${Gender}`;
export const seatKey = (e: Element, g: Gender): SeatKey => `${e}:${g}`;

export function alreadyVoted(voted: CascadeStatus['eligibility']['voted'], e: Element, g: Gender): boolean {
  return voted.some((v) => v.element === e && v.gender === g);
}

/**
 * The votes to send: every chosen seat the member hasn't voted for yet, in a fixed order
 * (Fire → Water, Male then Female). The website takes one vote per seat; seats already voted are
 * skipped, so a half-finished ballot can be completed later.
 */
export function votesToSend(
  chosen: Partial<Record<SeatKey, { user_id: number; name: string }>>,
  voted: CascadeStatus['eligibility']['voted'],
): { element: Element; gender: Gender; user_id: number; name: string }[] {
  const out: { element: Element; gender: Gender; user_id: number; name: string }[] = [];
  for (const e of ELEMENTS)
    for (const g of GENDERS) {
      const c = chosen[seatKey(e, g)];
      if (c && !alreadyVoted(voted, e, g)) out.push({ element: e, gender: g, user_id: c.user_id, name: c.name });
    }
  return out;
}
