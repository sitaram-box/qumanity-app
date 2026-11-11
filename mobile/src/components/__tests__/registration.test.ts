import { describe, expect, it } from 'vitest';
import { birthTimeFields, religionFields, religionLabel, RELIGIONS } from '../registration.logic';

// A copy of the website's RELIGION_BELIEF_VALUES (Qumanity_DPG/app.py) — the only values its
// /api/auth/register accepts for religion_belief (anything else is a 400).
const SERVER_RELIGION_VALUES = ['hindu', 'christian', 'muslim', 'sikh', 'buddhist', 'jain', 'other', 'prefer_not_to_say'];

describe('Spiritual path (religion_belief)', () => {
  it('offers exactly the 8 server values, in the website order', () => {
    expect(RELIGIONS.map((r) => r.value)).toEqual(SERVER_RELIGION_VALUES);
  });

  it('sends nothing when not answered, so the server stores NULL (not locked)', () => {
    expect(religionFields('')).toEqual({});
  });

  it('sends "Prefer not to say" as its own value (saved and locked like any other choice)', () => {
    expect(religionFields('prefer_not_to_say')).toEqual({ religion_belief: 'prefer_not_to_say' });
  });

  it('every value it can send is one the server accepts, with a label', () => {
    for (const r of RELIGIONS) {
      const sent = religionFields(r.value).religion_belief;
      expect(SERVER_RELIGION_VALUES).toContain(sent);
      expect(religionLabel(r.value)).toBe(r.label);
    }
    expect(religionLabel('')).toBeNull();
  });
});

describe('Birth time (tob / tob_unknown)', () => {
  it('"I don\'t remember" sends tob_unknown: true and no time at all', () => {
    const f = birthTimeFields('', true);
    expect(f).toEqual({ tob_unknown: true });
    expect('tob' in f).toBe(false);
  });

  it('a known time is sent as before, without tob_unknown', () => {
    const f = birthTimeFields('06:30', false);
    expect(f).toEqual({ tob: '06:30' });
    expect('tob_unknown' in f).toBe(false);
  });

  it('even a half-typed time is not sent once "don\'t remember" is ticked', () => {
    expect(birthTimeFields('06:3', true)).toEqual({ tob_unknown: true });
  });
});
