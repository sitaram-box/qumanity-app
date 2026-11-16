import { describe, expect, it } from 'vitest';
import { approveCall, buildRequest, canSend, statusView, verifierLines, type RecoveryForm } from '../familyRecovery.logic';

const form: RecoveryForm = {
  action: 'pin_reset',
  yourName: '  Arjun  Testkumar ',
  yourPrivateId: '123 456 789',
  theirName: 'Sunita Testkumar',
  theirPrivateId: '987-654-321',
  relationship: 'mother',
};

describe('Family recovery: the request form', () => {
  it('ready only when everything the website needs is there', () => {
    expect(canSend(form)).toBe(true);
    expect(canSend({ ...form, action: null })).toBe(false);
    expect(canSend({ ...form, relationship: null })).toBe(false);
    expect(canSend({ ...form, theirName: ' ' })).toBe(false);
    expect(canSend({ ...form, theirPrivateId: '12345' })).toBe(false);
  });

  it('your own Private ID is optional, but if typed it must be 9 digits', () => {
    expect(canSend({ ...form, yourPrivateId: '' })).toBe(true);
    expect(canSend({ ...form, yourPrivateId: '1234' })).toBe(false);
  });

  it('sends digits only and trimmed names; the relationship word as chosen', () => {
    expect(buildRequest(form)).toEqual({
      action: 'pin_reset',
      requester_name: 'Arjun  Testkumar',
      family_member_name: 'Sunita Testkumar',
      family_member_private_id: '987654321',
      relationship: 'mother',
      requester_private_id: '123456789',
    });
  });

  it('never sends your Private ID when you forgot it (Private ID / both)', () => {
    expect(buildRequest({ ...form, action: 'private_id' })).not.toHaveProperty('requester_private_id');
    expect(buildRequest({ ...form, action: 'both' })).not.toHaveProperty('requester_private_id');
  });
});

describe('Family recovery: what each status means for the person locked out', () => {
  const s = (status: string, extra = {}) => statusView({ status, action: 'both', expires_at: '', ...extra } as never).next;
  it('pending → wait; approved with PIN ready → set PIN; completed with ID → reveal', () => {
    expect(s('pending')).toBe('wait');
    expect(s('approved', { pin_reset_ready: true })).toBe('set_pin');
    expect(s('completed', { private_id_available: true })).toBe('reveal');
    expect(s('completed')).toBe('done');
  });
  it('rejected / expired / superseded → start again', () => {
    expect(s('rejected')).toBe('restart');
    expect(s('expired')).toBe('restart');
    expect(s('superseded')).toBe('restart');
  });
});

describe("Family recovery: the family member's Approve", () => {
  it('Private ID only → share it; PIN or both → approve the PIN reset (one decision per request)', () => {
    expect(approveCall('private_id')).toBe('share_id');
    expect(approveCall('pin_reset')).toBe('approve_pin');
    expect(approveCall('both')).toBe('approve_pin');
  });

  it('explains the verified relationship from the family member’s side', () => {
    const lines = verifierLines({
      id: 1, requester_claimed_name: 'Arjun Testkumar', verified_relationship: 'parent', action: 'both',
      status: 'pending', created_at: '', expires_at: '', can_act: true,
    });
    expect(lines.verified).toBe('Qumanity checked your Family Tree: you are their parent.');
    expect(lines.asks).toContain('their Private ID and a new PIN');
    expect(lines.approveMeans).toContain('also see their Private ID');
  });
});
