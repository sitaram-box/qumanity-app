/**
 * Registration input validation — used by the app (instant feedback) and the
 * `register` Cloud Function (authoritative). Returns field → message.
 */

import { isGender, type Gender } from './ids';
import { isLanguage } from './languages';
import { parseIsoDate } from './zodiac';

export interface ProfileInput {
  name: string;
  gender: Gender;
  dob: string; // YYYY-MM-DD
  tob: string; // HH:MM (24h)
  language: string;
}

export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>;

export function validateProfile(p: Partial<ProfileInput>, today: string): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = (p.name ?? '').trim();
  if (name.length < 2 || name.length > 80) errors.name = 'Enter your full name (2–80 characters).';
  if (!isGender(p.gender)) errors.gender = 'Choose Male, Female or Other.';
  try {
    parseIsoDate(p.dob ?? '');
    if ((p.dob ?? '') > today) errors.dob = 'Date of birth cannot be in the future.';
    else if ((p.dob ?? '') < '1900-01-01') errors.dob = 'Enter a date after 1900.';
  } catch {
    errors.dob = 'Enter a valid date of birth.';
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.tob ?? '')) errors.tob = 'Enter time of birth as HH:MM (24-hour).';
  if (!isLanguage(p.language)) errors.language = 'Choose your mother tongue.';
  return errors;
}

// ---- PIN --------------------------------------------------------------------

export const PIN_LENGTH = 5;
export const PIN_LOCK_AFTER = 5; // wrong tries → 15 min lock
export const PIN_OTP_AFTER = 10; // wrong tries → sign out, new OTP needed
export const PIN_LOCK_MINUTES = 15;

/** Returns an error message, or null if the PIN is acceptable. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{5}$/.test(pin)) return 'PIN must be exactly 5 digits.';
  if (/^(\d)\1{4}$/.test(pin)) return 'Avoid repeating one digit.';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'Avoid simple sequences like 12345.';
  return null;
}
