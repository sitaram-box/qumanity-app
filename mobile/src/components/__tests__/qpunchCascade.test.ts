import { describe, expect, it } from 'vitest';
import { approvalCandidateName, headLine, rotationLabel, seatKey, votesToSend } from '../qpunchCascade.logic';

const seat = (user_id: number, name: string) => ({ user_id, name, karma: 0 });
const members = {
  Fire: { male: seat(1, 'Agni'), female: seat(2, 'Jwala') },
  Earth: { male: seat(3, 'Bhoomi'), female: seat(4, 'Dhara') },
  Air: { male: seat(5, 'Pavan'), female: seat(6, 'Vayu') },
  Water: { male: seat(7, 'Varun'), female: seat(8, 'Ganga') },
};
const council = {
  id: 9, term_start: '', term_end: '', active_element: 'Earth' as const, head_user_id: null, head_gender: null,
  members, is_upper_house: true, approval: null,
};

describe('Q-Punch cascade: rotation', () => {
  it('labels each element relative to the one leading now (Fire → Earth → Air → Water)', () => {
    expect(rotationLabel('Earth', 'Earth')).toBe('Leading now');
    expect(rotationLabel('Air', 'Earth')).toBe('Next quarter');
    expect(rotationLabel('Water', 'Earth')).toBe('Upcoming');
    expect(rotationLabel('Fire', 'Earth')).toBe('Just finished');
  });
  it('wraps around: after Water comes Fire', () => {
    expect(rotationLabel('Fire', 'Water')).toBe('Next quarter');
  });
});

describe('Q-Punch cascade: the Head', () => {
  it('official Head when the Male won 51% approval', () => {
    expect(headLine({ ...council, head_user_id: 3, head_gender: 'male' })).toContain('Bhoomi is the official Head');
  });
  it('the Female leads with exceptional powers when the Male did not reach 51%', () => {
    expect(headLine({ ...council, head_user_id: 4, head_gender: 'female' })).toContain('Dhara holds the Head role');
  });
  it('approval still open: says until when; the ballot names the leading Male', () => {
    const open = { ...council, approval: { male_candidate_user_id: 3, approval_end: '2026-12-01', already_voted: false } };
    expect(headLine(open)).toContain('until 2026-12-01');
    expect(approvalCandidateName(open)).toBe('Bhoomi');
  });
  it('nothing decided and nothing open: no line', () => {
    expect(headLine(council)).toBeNull();
  });
});

describe('Q-Punch cascade: the ballot', () => {
  it('sends one vote per chosen seat, skipping seats already voted, in a fixed order', () => {
    const chosen = {
      [seatKey('Water', 'female')]: { user_id: 8, name: 'Ganga' },
      [seatKey('Fire', 'male')]: { user_id: 1, name: 'Agni' },
      [seatKey('Fire', 'female')]: { user_id: 2, name: 'Jwala' },
    };
    const out = votesToSend(chosen, [{ element: 'Fire', gender: 'female' }]);
    expect(out.map((v) => `${v.element}:${v.gender}`)).toEqual(['Fire:male', 'Water:female']);
  });
  it('nothing chosen: nothing to send', () => {
    expect(votesToSend({}, [])).toEqual([]);
  });
});
