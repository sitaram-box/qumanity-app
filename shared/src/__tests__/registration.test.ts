import { describe, expect, it } from 'vitest';
import { planRegistration, type RegistrationContext } from '../registration';

const s = { now: () => 'NOW', increment: (n: number) => `+${n}` };

const base: RegistrationContext = {
  authUid: 'auth-1',
  phone: '+918287696616',
  profile: { name: 'Rohit Mudgal', gender: 'M', dob: '1990-08-01', tob: '06:30', language: 'Hindi' },
  birth: { id: 'CS.DL.5.4.1', name: 'Kondli Village', level: 'village', country_id: 'O_AS_IND' },
  present: { id: 'CS.DL.3.4.2', name: 'Bawana', level: 'village', country_id: 'O_AS_IND' },
  chain: { village: '111111111', tehsil: '222222222', earth: '999999999' },
  userId: '482915307',
  accountId: '7310042285',
  userIdReserved: false,
  bornSerialBefore: 41,
  residentSerialBefore: 106,
  today: '2026-09-27',
};

const byPath = (w: ReturnType<typeof planRegistration>) => Object.fromEntries(w.map((x) => [x.path, x]));

describe('planRegistration', () => {
  it('reserves both numbers and writes hidden readable IDs with the next serials', () => {
    const w = byPath(planRegistration(base, s));
    expect(w['id_registry/482915307']).toMatchObject({ op: 'set', data: { kind: 'user', uid: 'auth-1' } });
    expect(w['id_registry/7310042285']).toMatchObject({ op: 'set', data: { kind: 'account' } });
    expect(w['counters/CS.DL.5.4.1'].data).toEqual({ born_serial: 42 });
    expect(w['counters/CS.DL.3.4.2'].data).toEqual({ resident_serial: 107 });
    expect(w['identities/482915307'].data.readable_id).toBe('RM-0042-GM-AY-FL-CS.DL.5.4.1');
    expect(w['account_identities/7310042285'].data.readable_id).toBe('RM-0107-GM-AY-FL-CS.DL.3.4.2');
    expect(w['uid_links/auth-1'].data).toMatchObject({ user_id: '482915307', account_id: '7310042285', village_id: 'CS.DL.3.4.2' });
  });

  it('counts the user only in present-chain groups', () => {
    const w = planRegistration(base, s).filter((x) => x.path.startsWith('groups/'));
    expect(w.map((x) => x.path).sort()).toEqual(['groups/111111111', 'groups/222222222', 'groups/999999999']);
    expect(w.every((x) => x.op === 'update' && x.data.user_count === '+1')).toBe(true);
  });

  it('uses one counter doc when born and living in the same village', () => {
    const w = planRegistration({ ...base, present: { ...base.birth }, residentSerialBefore: 5 }, s);
    const counters = w.filter((x) => x.path.startsWith('counters/'));
    expect(counters).toEqual([{ path: 'counters/CS.DL.5.4.1', op: 'merge', data: { born_serial: 42, resident_serial: 6 } }]);
  });

  it("claims the owner's pre-reserved User ID instead of creating one", () => {
    const w = byPath(planRegistration({ ...base, userIdReserved: true }, s));
    expect(w['id_registry/482915307']).toEqual({ path: 'id_registry/482915307', op: 'update', data: { uid: 'auth-1' } });
  });
});
