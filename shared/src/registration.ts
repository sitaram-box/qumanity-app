/**
 * Registration as a list of Firestore writes, done in ONE client transaction
 * during the Spark testing phase (no Cloud Functions). firebase/firestore.rules
 * validates every write against the others (getAfter), so a modified app
 * cannot mint someone else's ID, skip a serial, or join groups it does not
 * live in. On Blaze the same plan can run inside the `register` function.
 *
 * SDK-neutral: the caller supplies `now()` and `increment()` sentinels.
 */

import type { Chain, LocationRef } from './schema';
import { COL } from './schema';
import { personCodes, readableId, type Gender } from './ids';
import type { ProfileInput } from './profile';

export interface Sentinels {
  now: () => unknown;
  increment: (n: number) => unknown;
}

export interface RegistrationContext {
  authUid: string;
  phone: string;
  profile: ProfileInput;
  birth: LocationRef;
  present: LocationRef; // a village
  /** Group ids of the present village's chain (copied from locations/{village}.chain). */
  chain: Chain;
  userId: string;
  accountId: string;
  /** The owner's User ID is pre-reserved by tools/ops (registry doc already exists). */
  userIdReserved: boolean;
  /** Current counter values read inside the transaction (0 if the doc is missing). */
  bornSerialBefore: number;
  residentSerialBefore: number;
  today: string; // YYYY-MM-DD
}

export interface PlannedWrite {
  path: string;
  data: Record<string, unknown>;
  /** 'set' creates/overwrites, 'merge' merges, 'update' requires the doc to exist. */
  op: 'set' | 'merge' | 'update';
}

export function planRegistration(ctx: RegistrationContext, s: Sentinels): PlannedWrite[] {
  const codes = personCodes({ name: ctx.profile.name, gender: ctx.profile.gender as Gender, dob: ctx.profile.dob }, ctx.today);
  const bornSerial = ctx.bornSerialBefore + 1;
  const sameVillage = ctx.birth.id === ctx.present.id;
  const residentSerial = ctx.residentSerialBefore + 1;
  const name = ctx.profile.name.trim();
  const now = s.now();

  const writes: PlannedWrite[] = [];

  // 1. Reserve the numbers (create-only in rules, so a taken number fails the transaction).
  if (ctx.userIdReserved) {
    writes.push({ path: `${COL.idRegistry}/${ctx.userId}`, op: 'update', data: { uid: ctx.authUid } });
  } else {
    writes.push({ path: `${COL.idRegistry}/${ctx.userId}`, op: 'set', data: { kind: 'user', uid: ctx.authUid, created_at: now } });
  }
  writes.push({ path: `${COL.idRegistry}/${ctx.accountId}`, op: 'set', data: { kind: 'account', uid: ctx.authUid, created_at: now } });

  // 2. Serials: born-here in the birth place, resident in the present village.
  if (sameVillage) {
    writes.push({ path: `${COL.counters}/${ctx.birth.id}`, op: 'merge', data: { born_serial: bornSerial, resident_serial: residentSerial } });
  } else {
    writes.push({ path: `${COL.counters}/${ctx.birth.id}`, op: 'merge', data: { born_serial: bornSerial } });
    writes.push({ path: `${COL.counters}/${ctx.present.id}`, op: 'merge', data: { resident_serial: residentSerial } });
  }

  // 3. The auth link the security rules read for every permission check.
  writes.push({
    path: `${COL.uidLinks}/${ctx.authUid}`,
    op: 'set',
    data: { user_id: ctx.userId, account_id: ctx.accountId, chain: ctx.chain, village_id: ctx.present.id, created_at: now },
  });

  // 4. Private user record, public profile, hidden readable IDs.
  writes.push({
    path: `${COL.users}/${ctx.userId}`,
    op: 'set',
    data: {
      user_id: ctx.userId,
      auth_uid: ctx.authUid,
      phone: ctx.phone,
      name,
      gender: ctx.profile.gender,
      dob: ctx.profile.dob,
      tob: ctx.profile.tob,
      language: ctx.profile.language,
      zodiac_type: codes.zodiac_type,
      age_type: codes.age_type,
      account_id: ctx.accountId,
      account_ids: [ctx.accountId],
      birth_location: ctx.birth,
      present_location: ctx.present,
      chain: ctx.chain,
      personal_groups: {},
      fcm_tokens: [],
      created_at: now,
    },
  });
  writes.push({
    path: `${COL.accounts}/${ctx.accountId}`,
    op: 'set',
    data: {
      account_id: ctx.accountId,
      display_name: name,
      photo_url: null,
      village_name: ctx.present.name,
      village_group: ctx.chain.village ?? null,
      active: true,
      created_at: now,
    },
  });
  writes.push({
    path: `${COL.identities}/${ctx.userId}`,
    op: 'set',
    data: { readable_id: readableId(codes, bornSerial, ctx.birth.id), user_id: ctx.userId, serial: bornSerial, location_id: ctx.birth.id, created_at: now },
  });
  writes.push({
    path: `${COL.accountIdentities}/${ctx.accountId}`,
    op: 'set',
    data: { readable_id: readableId(codes, residentSerial, ctx.present.id), user_id: ctx.userId, serial: residentSerial, location_id: ctx.present.id, created_at: now },
  });

  // 5. Present residents are counted up the whole chain (birth places are not).
  for (const groupId of Object.values(ctx.chain)) {
    if (groupId) writes.push({ path: `${COL.groups}/${groupId}`, op: 'update', data: { user_count: s.increment(1) } });
  }
  return writes;
}
