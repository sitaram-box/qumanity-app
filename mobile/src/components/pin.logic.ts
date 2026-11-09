/**
 * PIN and one-time-code input rules, kept free of React / React Native imports so they can be
 * unit-tested under plain vitest (same reason as electionCard.logic.ts).
 *
 * The PIN rule is the website's, not the app's: `PIN_RE` in Qumanity_DPG/app.py — exactly 5
 * characters from letters, digits and the symbols below, at least one letter or digit, and
 * case-sensitive (never normalised). The server checks it on sign-in, registration, PIN change
 * and PIN reset, and stays the authority: this file only stops a character the server would
 * never accept from being typed. The "at least one letter or digit" part is left to the server,
 * whose own message is shown if it fails.
 *
 * Before 2026-11-09 the app accepted digits only, so a member whose PIN contained a letter or a
 * symbol (allowed on the website) could not sign in on the phone at all.
 */

export const PIN_LENGTH = 5;

/** One allowed PIN character — the same character class as the website's PIN_RE. */
const PIN_CHAR = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{}|;:'",.<>/?]$/;

/** Shown wherever a member chooses a new PIN; worded like the website's PIN_FORMAT_ERROR. */
export const PIN_HINT = '5 characters: numbers, letters or symbols — but not only symbols.';

/** Keeps only characters the server accepts, in order, case unchanged, at most 5. */
export function cleanPinInput(text: string): string {
  return Array.from(text)
    .filter((ch) => PIN_CHAR.test(ch))
    .join('')
    .slice(0, PIN_LENGTH);
}

/** One-time codes (PIN reset by SMS/email) stay digits only. */
export function cleanOtpInput(text: string, length: number): string {
  return text.replace(/\D/g, '').slice(0, length);
}
