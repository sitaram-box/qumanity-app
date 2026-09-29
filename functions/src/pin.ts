/**
 * setPin / verifyPin callables (docs/DEVELOPMENT_PLAN.md §5).
 * secrets/{authUid} is server-only (denied to clients in firestore.rules).
 */

import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { COL, PIN_LOCK_AFTER, PIN_LOCK_MINUTES, PIN_OTP_AFTER, pinProblem } from '../../shared/src';
import { checkPin, hashPin } from './pinHash';

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in with your phone number first.');
  return uid;
}

/** Create or change the PIN. Changing requires the current PIN. */
export const setPin = onCall<{ pin: string; currentPin?: string }>(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const pin = String(req.data?.pin ?? '');
  const problem = pinProblem(pin);
  if (problem) throw new HttpsError('invalid-argument', problem);

  const ref = getFirestore().collection(COL.secrets).doc(uid);
  const snap = await ref.get();
  if (snap.exists && snap.get('hash')) {
    const ok = await checkPin(String(req.data?.currentPin ?? ''), snap.data() as { hash: string; salt: string });
    if (!ok) throw new HttpsError('permission-denied', 'Current PIN is wrong.');
  }
  await ref.set({ ...(await hashPin(pin)), failed: 0, locked_until: null, updated_at: FieldValue.serverTimestamp() });
  return { ok: true };
});

export interface VerifyPinResult {
  ok: boolean;
  triesLeft?: number;
  lockedUntil?: string;
  otpRequired?: boolean;
}

export const verifyPin = onCall<{ pin: string }, Promise<VerifyPinResult>>(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const db = getFirestore();
  const ref = db.collection(COL.secrets).doc(uid);
  const snap = await ref.get();
  if (!snap.exists || !snap.get('hash')) throw new HttpsError('failed-precondition', 'No PIN set yet.');

  const lockedUntil = snap.get('locked_until') as Timestamp | null;
  if (lockedUntil && lockedUntil.toMillis() > Date.now()) {
    return { ok: false, lockedUntil: lockedUntil.toDate().toISOString() };
  }

  if (await checkPin(String(req.data?.pin ?? ''), snap.data() as { hash: string; salt: string })) {
    await ref.update({ failed: 0, locked_until: null });
    return { ok: true };
  }

  const failed = (snap.get('failed') ?? 0) + 1;
  if (failed >= PIN_OTP_AFTER) {
    // Too many wrong PINs: sign the phone out everywhere so a fresh OTP is needed.
    await ref.update({ failed: 0, locked_until: Timestamp.fromMillis(Date.now() + PIN_LOCK_MINUTES * 60_000) });
    await getAuth().revokeRefreshTokens(uid);
    return { ok: false, otpRequired: true };
  }
  if (failed % PIN_LOCK_AFTER === 0) {
    const until = Timestamp.fromMillis(Date.now() + PIN_LOCK_MINUTES * 60_000);
    await ref.update({ failed, locked_until: until });
    return { ok: false, lockedUntil: until.toDate().toISOString() };
  }
  await ref.update({ failed });
  return { ok: false, triesLeft: PIN_LOCK_AFTER - (failed % PIN_LOCK_AFTER) };
});

/** Whether this signed-in phone has a PIN yet (lets the app resume registration). */
export const pinStatus = onCall(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const snap = await getFirestore().collection(COL.secrets).doc(uid).get();
  return { hasPin: snap.exists && !!snap.get('hash') };
});
