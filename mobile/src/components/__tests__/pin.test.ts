import { describe, expect, it } from 'vitest';
import { cleanOtpInput, cleanPinInput, PIN_LENGTH } from '../pin.logic';

// A character-for-character transcription of the website's PIN_RE (Qumanity_DPG/app.py) — the
// rule the server applies on sign-in, registration, PIN change and PIN reset.
const SERVER_PIN_RE = /^(?=.*[A-Za-z0-9])[A-Za-z0-9!@#$%^&*()_+\-=[\]{}|;:'",.<>/?]{5}$/;

describe('PIN input (matches the website rule)', () => {
  it('keeps letters, digits and the allowed symbols, case unchanged', () => {
    expect(cleanPinInput('Ab#12')).toBe('Ab#12');
    expect(cleanPinInput('aB9!z')).toBe('aB9!z');
    expect(cleanPinInput('12345')).toBe('12345'); // digit-only PINs made before 2026-11 still work
  });

  it('drops characters the server never accepts (space, ~, `, \\, emoji, accented letters)', () => {
    expect(cleanPinInput('a b~c`d\\e')).toBe('abcde');
    expect(cleanPinInput('1😀2é3')).toBe('123');
  });

  it(`stops at ${PIN_LENGTH} characters`, () => {
    expect(cleanPinInput('Ab#12XYZ')).toBe('Ab#12');
  });

  it('every complete PIN it lets through is one the server accepts, unless it is all symbols', () => {
    for (const typed of ['Ab#12', '12345', 'zZ9?/', "a'\",.<", '[]{}a', 'x!!!!']) {
      const pin = cleanPinInput(typed);
      expect(pin).toHaveLength(5);
      expect(SERVER_PIN_RE.test(pin)).toBe(true);
    }
    // The one rule left to the server: at least one letter or digit. Its own message is shown.
    expect(SERVER_PIN_RE.test(cleanPinInput('!@#$%'))).toBe(false);
  });
});

describe('one-time code input', () => {
  it('stays digits only', () => {
    expect(cleanOtpInput('12a3-4 5', 6)).toBe('12345');
    expect(cleanOtpInput('1234567', 6)).toBe('123456');
  });
});
