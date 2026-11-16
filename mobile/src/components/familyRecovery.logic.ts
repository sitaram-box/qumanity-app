/**
 * Family recovery (website family_recovery_core): what the form sends, what each status means for
 * the person locked out, and which website action a family member's "Approve" maps to. Free of
 * React / React Native imports so it can be unit-tested under plain vitest (same reason as
 * pin.logic.ts). The website checks everything; this only keeps the app from sending a request
 * that can't work and picks the right next step.
 */

import type { FamilyRecoveryDetail, FamilyRecoveryRequest, FamilyRecoveryStatus, RecoveryAction } from '@/api/qumanity';

/** Who the family member is TO the requester (website: "father" = the family member is your father). */
export const RELATIONSHIPS = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'husband', label: 'Husband' },
  { value: 'wife', label: 'Wife' },
] as const;

export const ACTIONS: { value: RecoveryAction; label: string }[] = [
  { value: 'pin_reset', label: 'My PIN' },
  { value: 'private_id', label: 'My Private ID' },
  { value: 'both', label: 'Both' },
];

export interface RecoveryForm {
  action: RecoveryAction | null;
  yourName: string;
  /** Only used when just the PIN is forgotten; optional even then. */
  yourPrivateId: string;
  theirName: string;
  theirPrivateId: string;
  relationship: string | null;
}

const digits = (s: string) => s.replace(/\D/g, '');

/** Ready to send: everything the website needs, in a shape it can accept. */
export function canSend(f: RecoveryForm): boolean {
  const own = digits(f.yourPrivateId);
  return (
    !!f.action &&
    !!f.relationship &&
    f.yourName.trim().length >= 2 &&
    f.theirName.trim().length >= 2 &&
    digits(f.theirPrivateId).length === 9 &&
    (own.length === 0 || own.length === 9)
  );
}

export function buildRequest(f: RecoveryForm): FamilyRecoveryRequest {
  const own = digits(f.yourPrivateId);
  return {
    action: f.action!,
    requester_name: f.yourName.trim(),
    family_member_name: f.theirName.trim(),
    family_member_private_id: digits(f.theirPrivateId),
    relationship: f.relationship!,
    // Only for "forgot my PIN": someone who forgot their Private ID can't know it.
    ...(f.action === 'pin_reset' && own.length === 9 ? { requester_private_id: own } : {}),
  };
}

export type NextStep = 'wait' | 'reveal' | 'set_pin' | 'done' | 'restart';

/** What the locked-out member sees for a status, and what they can do next. */
export function statusView(s: FamilyRecoveryStatus): { title: string; text: string; next: NextStep } {
  switch (s.status) {
    case 'pending':
      return { title: 'Waiting for your family member', text: 'They have been asked to approve your request. Check back here later.', next: 'wait' };
    case 'approved':
      return s.pin_reset_ready
        ? { title: 'Approved', text: 'Your family member approved it. Set your new PIN now (within 24 hours of their approval).', next: 'set_pin' }
        : { title: 'Approved', text: 'Your family member approved it.', next: 'done' };
    case 'completed':
      return s.private_id_available
        ? { title: 'Your Private ID is ready', text: 'Your family member helped you. You can see your Private ID now.', next: 'reveal' }
        : { title: 'Done', text: 'Your new PIN is set. Sign in with your Private ID and your new PIN.', next: 'done' };
    case 'rejected':
      return { title: 'Declined', text: 'Your family member declined this request. You can send a new one, or use the other recovery options.', next: 'restart' };
    case 'expired':
      return { title: 'Expired', text: 'This request is no longer active. You can send a new one.', next: 'restart' };
    case 'superseded':
      return { title: 'Replaced', text: 'A newer request replaced this one. Check that one instead, or send a new one.', next: 'restart' };
    default:
      return { title: 'Unknown', text: 'Check again later.', next: 'wait' };
  }
}

/**
 * The family member's single "Approve". The website takes ONE decision per request: sharing the
 * Private ID completes it at once, so for "both" Approve must approve the PIN reset instead — once
 * the requester sets their new PIN, the request completes and their Private ID becomes visible to
 * them too. Sharing first would leave the PIN reset impossible.
 */
export function approveCall(action: RecoveryAction): 'approve_pin' | 'share_id' {
  return action === 'private_id' ? 'share_id' : 'approve_pin';
}

const REL_TEXT: Record<FamilyRecoveryDetail['verified_relationship'], string> = {
  parent: 'their parent',
  child: 'their child',
  sibling: 'their brother or sister',
  spouse: 'their husband or wife',
};
const WANTS: Record<RecoveryAction, string> = {
  private_id: 'their Private ID',
  pin_reset: 'a new PIN',
  both: 'their Private ID and a new PIN',
};

/** For the family member's card: "Qumanity checked your Family Tree: you are their parent." */
export function verifierLines(d: FamilyRecoveryDetail): { asks: string; verified: string; approveMeans: string } {
  return {
    asks: `${d.requester_claimed_name} is locked out and asks you to help them get back ${WANTS[d.action]}.`,
    verified: `Qumanity checked your Family Tree: you are ${REL_TEXT[d.verified_relationship] ?? 'their relative'}.`,
    approveMeans:
      approveCall(d.action) === 'share_id'
        ? 'Approve shares their Private ID with them. You will not see it yourself.'
        : 'Approve lets them set a new PIN within 24 hours.' + (d.action === 'both' ? ' Once they do, they can also see their Private ID.' : ''),
  };
}
