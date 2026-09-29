import { describe, expect, it } from 'vitest';
import {
  ageType,
  formatId,
  isAccountId,
  isUserId,
  nameInitials,
  newAccountId,
  newUserId,
  normalizeIdInput,
  parseReadableId,
  personCodes,
  readableId,
  ZODIAC_CODES,
} from '../ids';
import { pinProblem, validateProfile } from '../profile';

describe('numeric IDs', () => {
  it('User IDs are 9 digits, Account IDs 10, never leading 0', () => {
    for (let i = 0; i < 300; i++) {
      expect(isUserId(newUserId())).toBe(true);
      expect(isAccountId(newAccountId())).toBe(true);
    }
    expect(newUserId(() => 0)).toBe('100000000');
    expect(isUserId('012345678')).toBe(false);
    expect(isAccountId('482915307')).toBe(false);
  });

  it('formats and normalizes for display/search', () => {
    expect(formatId('482915307')).toBe('482 915 307');
    expect(formatId('7310042285')).toBe('7310 042 285');
    expect(normalizeIdInput(' 7310-042 285 ')).toBe('7310042285');
  });
});

describe('readable (hidden) IDs', () => {
  it('initials: first + last word, or first + last letter', () => {
    expect(nameInitials('Rohit Mudgal')).toBe('RM');
    expect(nameInitials('Rohit Kumar Mudgal')).toBe('RM');
    expect(nameInitials('sita')).toBe('SA');
    expect(nameInitials('')).toBe('XX');
  });

  it('age types follow the website bands', () => {
    expect(ageType('2001-09-27', '2026-09-26')).toBe('B'); // 24
    expect(ageType('2001-09-26', '2026-09-26')).toBe('Y'); // 25
    expect(ageType('1976-09-26', '2026-09-26')).toBe('V'); // 50
    expect(ageType('1950-09-27', '2026-09-26')).toBe('V'); // 75
    expect(ageType('1950-09-26', '2026-09-26')).toBe('S'); // 76
  });

  it('zodiac codes match the website table', () => {
    expect(ZODIAC_CODES.Libra).toBe('AL');
    expect(Object.keys(ZODIAC_CODES)).toHaveLength(12);
  });

  it('builds and parses RM-0042-GM-AY-FL-<location>', () => {
    const codes = personCodes({ name: 'Rohit Mudgal', gender: 'M', dob: '1990-08-01' }, '2026-09-26');
    expect(codes).toMatchObject({ initials: 'RM', age_type: 'Y', zodiac_type: 'Leo', zodiac_code: 'FL', element: 'Fire' });
    const id = readableId(codes, 42, 'CS.DL.5.4.1E');
    expect(id).toBe('RM-0042-GM-AY-FL-CS.DL.5.4.1E');
    expect(parseReadableId(id)).toEqual({
      initials: 'RM', serial: 42, gender: 'M', age_type: 'Y', zodiac_code: 'FL', location_id: 'CS.DL.5.4.1E',
    });
    expect(readableId(codes, 12345, 'NP.BA.1.1.1')).toBe('RM-12345-GM-AY-FL-NP.BA.1.1.1');
  });

  it('rejects bad serials', () => {
    const codes = personCodes({ name: 'A B', gender: 'F', dob: '2000-01-01' }, '2026-01-01');
    expect(() => readableId(codes, 0, 'X')).toThrow();
  });
});

describe('registration validation', () => {
  it('accepts a complete profile', () => {
    expect(validateProfile({ name: 'Rohit Mudgal', gender: 'M', dob: '1990-08-01', tob: '06:30', language: 'Hindi' }, '2026-09-26')).toEqual({});
  });

  it('flags every bad field', () => {
    const e = validateProfile({ name: 'R', gender: 'X' as never, dob: '2030-01-01', tob: '25:00', language: 'Klingon' }, '2026-09-26');
    expect(Object.keys(e).sort()).toEqual(['dob', 'gender', 'language', 'name', 'tob']);
  });

  it('PIN: 5 digits, no repeats or sequences', () => {
    expect(pinProblem('48291')).toBeNull();
    expect(pinProblem('1234')).not.toBeNull();
    expect(pinProblem('11111')).not.toBeNull();
    expect(pinProblem('12345')).not.toBeNull();
    expect(pinProblem('54321')).not.toBeNull();
    expect(pinProblem('12a45')).not.toBeNull();
  });
});
