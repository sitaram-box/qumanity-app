/**
 * register callable (docs/DEVELOPMENT_PLAN.md §4–§5).
 *
 * After phone OTP + PIN, mints the 9-digit User ID and 10-digit Account ID,
 * the hidden readable IDs, serials (born-here in the birth village, resident
 * in the present village), joins the present chain, bumps user_count up the
 * chain, and sets the auth claims the security rules rely on.
 */

import { randomInt } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  COL,
  countryCodeOf,
  newAccountId,
  newUserId,
  personCodes,
  readableId,
  validateProfile,
  type AccountDoc,
  type LocationDoc,
  type LocationRef,
  type ProfileInput,
  type UserDoc,
} from '../../shared/src';
import { birthLocationProblem, buildChain, presentLocationProblem } from './chain';

export const OWNER_PHONE = defineString('OWNER_PHONE', { description: 'Mentor (owner) phone number in E.164, e.g. +91XXXXXXXXXX' });

export interface RegisterInput extends ProfileInput {
  birthLocationId: string;
  presentLocationId: string;
}

export interface RegisterResult {
  userId: string;
  accountId: string;
}

const cryptoRand = (max: number) => randomInt(max);

/** Read a location and its ancestors, leaf → root. */
async function locationPath(db: Firestore, id: string): Promise<LocationDoc[]> {
  const path: LocationDoc[] = [];
  let next: string | null = id;
  for (let depth = 0; next && depth < 10; depth++) {
    const snap = await db.collection(COL.locations).doc(next).get();
    if (!snap.exists) break;
    const loc = snap.data() as LocationDoc;
    path.push(loc);
    next = loc.parent_id;
  }
  return path;
}

function toRef(path: LocationDoc[], countryId: string): LocationRef {
  const leaf = path[0];
  return { id: leaf.id, name: leaf.name, level: leaf.level, country_id: countryId };
}

/** Pick an unused number from a few random candidates, inside the transaction. */
async function reserveNumber(tx: Transaction, db: Firestore, make: () => string): Promise<DocumentReference> {
  const refs = Array.from({ length: 5 }, () => db.collection(COL.idRegistry).doc(make()));
  const snaps = await tx.getAll(...refs);
  const free = snaps.find((s) => !s.exists);
  if (!free) throw new HttpsError('aborted', 'Could not allocate an ID, please retry.');
  return free.ref;
}

export const register = onCall<RegisterInput, Promise<RegisterResult>>(async (req) => {
  const authUid = req.auth?.uid;
  const phone = req.auth?.token.phone_number;
  if (!authUid || !phone) throw new HttpsError('unauthenticated', 'Sign in with your phone number first.');

  const db = getFirestore();
  const input = req.data ?? ({} as RegisterInput);
  const today = new Date().toISOString().slice(0, 10);

  const errors = validateProfile(input, today);
  if (Object.keys(errors).length) throw new HttpsError('invalid-argument', 'Please fix the highlighted fields.', { errors });

  const secret = await db.collection(COL.secrets).doc(authUid).get();
  if (!secret.exists || !secret.get('hash')) throw new HttpsError('failed-precondition', 'Create your 5-digit PIN first.');

  const [birthPath, presentPath] = await Promise.all([
    locationPath(db, String(input.birthLocationId ?? '')),
    locationPath(db, String(input.presentLocationId ?? '')),
  ]);
  const birth = buildChain(birthPath);
  const present = buildChain(presentPath);

  const problem =
    birthLocationProblem(birthPath[0], birth.countryId) ?? presentLocationProblem(presentPath[0], present.countryId);
  if (problem) throw new HttpsError('invalid-argument', problem);

  // Registration opens only when the whole present chain is active (has a council member).
  // The owner (Mentor) may register first, before groups are bootstrapped.
  const isOwner = phone === OWNER_PHONE.value();
  if (!isOwner) {
    if (present.missing.length) throw new HttpsError('failed-precondition', 'Your location groups are not open yet.');
    const groups = await db.getAll(...Object.values(present.chain).map((g) => db.collection(COL.groups).doc(g!)));
    if (groups.some((g) => !g.exists || g.get('is_active') !== true)) {
      throw new HttpsError('failed-precondition', 'Your location groups are not active yet.');
    }
  }

  const codes = personCodes(input, today);
  const birthLoc = toRef(birthPath, birth.countryId!);
  const presentLoc = toRef(presentPath, present.countryId!);
  const linkRef = db.collection('auth_links').doc(authUid);
  const birthCounter = db.collection(COL.counters).doc(birthLoc.id);
  const presentCounter = db.collection(COL.counters).doc(presentLoc.id);

  const result = await db.runTransaction(async (tx) => {
    // ---- reads ----
    const link = await tx.get(linkRef);
    if (link.exists) throw new HttpsError('already-exists', 'This phone number is already registered.');
    const [birthC, presentC] = await tx.getAll(birthCounter, presentCounter);
    const userRef = await reserveNumber(tx, db, () => newUserId(cryptoRand));
    const accountRef = await reserveNumber(tx, db, () => newAccountId(cryptoRand));

    const sameVillage = birthLoc.id === presentLoc.id;
    const bornSerial = (birthC.get('born_serial') ?? 0) + 1;
    const residentSerial = (presentC.get('resident_serial') ?? 0) + 1;
    const userId = userRef.id;
    const accountId = accountRef.id;

    // ---- writes ----
    const now = FieldValue.serverTimestamp();
    tx.set(userRef, { kind: 'user', ref: userId, created_at: now });
    tx.set(accountRef, { kind: 'account', ref: userId, created_at: now });
    if (sameVillage) {
      tx.set(birthCounter, { born_serial: bornSerial, resident_serial: residentSerial }, { merge: true });
    } else {
      tx.set(birthCounter, { born_serial: bornSerial }, { merge: true });
      tx.set(presentCounter, { resident_serial: residentSerial }, { merge: true });
    }

    const user: UserDoc = {
      user_id: userId,
      auth_uid: authUid,
      phone,
      name: input.name.trim(),
      gender: input.gender,
      dob: input.dob,
      tob: input.tob,
      language: input.language,
      zodiac_type: codes.zodiac_type,
      age_type: codes.age_type,
      account_id: accountId,
      account_ids: [accountId],
      birth_location: birthLoc,
      present_location: presentLoc,
      chain: present.chain,
      personal_groups: {},
      fcm_tokens: [],
      pin_set: true,
      created_at: now,
    };
    tx.set(db.collection(COL.users).doc(userId), user);

    const account: AccountDoc = {
      account_id: accountId,
      display_name: input.name.trim(),
      photo_url: null,
      village_name: presentLoc.name,
      village_group: present.chain.village ?? null,
      active: true,
      created_at: now,
    };
    tx.set(db.collection(COL.accounts).doc(accountId), account);

    tx.set(db.collection(COL.identities).doc(userId), {
      readable_id: readableId(codes, bornSerial, birthLoc.id),
      user_id: userId,
      serial: bornSerial,
      location_id: birthLoc.id,
      codes,
      created_at: now,
    });
    tx.set(db.collection(COL.accountIdentities).doc(accountId), {
      readable_id: readableId(codes, residentSerial, presentLoc.id),
      user_id: userId,
      serial: residentSerial,
      location_id: presentLoc.id,
      created_at: now,
    });
    tx.set(linkRef, { user_id: userId, created_at: now });

    // Present residents are the basis of member counting; birth villages are not counted.
    for (const groupId of Object.values(present.chain)) {
      tx.set(db.collection(COL.groups).doc(groupId!), { user_count: FieldValue.increment(1) }, { merge: true });
    }
    return { userId, accountId };
  });

  await getAuth().setCustomUserClaims(authUid, {
    qid: result.userId,
    acc: result.accountId,
    chain: present.chain,
    cc: countryCodeOf(present.countryId!),
    ...(isOwner ? { owner: true } : {}),
  });
  return result;
});
