/**
 * Qumanity ops — admin commands run from the Mac (testing phase on Spark).
 *
 *   npm run ops -- plan   --pilot CS.DL                       dry run: counts only, no Firebase
 *   npm run ops -- seed   --pilot CS.DL --owner-phone +91…     seed config, locations, groups (resumable)
 *   npm run ops -- deploy-rules                                publish firebase/firestore.rules
 *   npm run ops -- status                                      document counts
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 * (Firebase console → Project settings → Service accounts). Keep that file
 * OUTSIDE this folder; it is an admin key.
 */

import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { COUNCIL_SEATS, locationDocId, newGroupId, newUserId } from '../../../shared/src';
import { planSeed, type Master, type SeedPlan } from './seedPlan';

const HERE = __dirname;
const APP_ROOT = resolve(HERE, '../../..');
const STATE_DIR = resolve(HERE, '../.state');
const MASTER = process.env.QM_MASTER_JSON ?? join(homedir(), 'Desktop/0_Earth/Qumanity_Master.json');
const DAILY_WRITE_BUDGET = Number(process.env.QM_WRITE_BUDGET ?? 19_000); // Spark: 20k/day

const cryptoRand = (max: number) => randomInt(max);

function projectId(): string {
  const rc = JSON.parse(readFileSync(join(APP_ROOT, '.firebaserc'), 'utf8'));
  return rc.projects.default;
}

function db(): Firestore {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON (kept outside this folder).');
  }
  initializeApp({ credential: applicationDefault(), projectId: projectId() });
  return getFirestore();
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function pilotsArg(): string[] {
  const p = arg('pilot');
  if (!p) throw new Error('Pass --pilot <location id>[,<id>…], e.g. --pilot CS.DL');
  return p.split(',').map((s) => s.trim()).filter(Boolean);
}

function loadMaster(): Master {
  console.log(`Reading ${MASTER} …`);
  return JSON.parse(readFileSync(MASTER, 'utf8'));
}

// ---- persistent seed state (same ids across resumed runs) ----
interface SeedState {
  pilots: string[];
  ownerPhone: string;
  ownerUserId: string;
  plan: SeedPlan;
  done: number; // writes completed, in the fixed order of `jobs()`
}

const statePath = () => join(STATE_DIR, 'seed.json');

function loadOrCreateState(pilots: string[], ownerPhone: string): SeedState {
  if (existsSync(statePath())) {
    const s: SeedState = JSON.parse(readFileSync(statePath(), 'utf8'));
    if (s.pilots.join() !== pilots.join() || s.ownerPhone !== ownerPhone) {
      throw new Error(`A different seed is in progress (${s.pilots.join()}). Delete ${statePath()} to start over.`);
    }
    return s;
  }
  const plan = planSeed(loadMaster(), pilots, () => newGroupId(cryptoRand));
  const s: SeedState = { pilots, ownerPhone, ownerUserId: newUserId(cryptoRand), plan, done: 0 };
  saveState(s);
  return s;
}

function saveState(s: SeedState) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(), JSON.stringify(s));
}

type Job = { path: string; data: Record<string, unknown> };

/** Every write of the seed, in a fixed order so a run can resume. */
function jobs(s: SeedState): Job[] {
  const now = FieldValue.serverTimestamp();
  const council: Record<string, unknown> = {};
  for (const seat of COUNCIL_SEATS) {
    council[String(seat.seat)] = {
      title: seat.title,
      method: seat.method,
      holder_id: seat.seat === 1 ? s.ownerUserId : null,
      since: seat.seat === 1 ? now : null,
      term_end: null,
    };
  }
  const list: Job[] = [
    { path: 'config/roles', data: { owner_phone: s.ownerPhone, owner_user_id: s.ownerUserId, pilots: s.pilots, updated_at: now } },
    { path: `id_registry/${s.ownerUserId}`, data: { kind: 'user', uid: null, reserved_phone: s.ownerPhone, created_at: now } },
  ];
  for (const l of s.plan.locations) list.push({ path: `locations/${locationDocId(l.id)}`, data: { ...l } });
  for (const g of s.plan.groups) {
    list.push({
      path: `groups/${g.group_id}`,
      data: { ...g, council, council_ids: [s.ownerUserId], is_active: true, user_count: 0, created_at: now },
    });
    list.push({ path: `id_registry/${g.group_id}`, data: { kind: 'group', ref: g.code, created_at: now } });
  }
  return list;
}

async function seed() {
  const pilots = pilotsArg();
  const ownerPhone = arg('owner-phone');
  if (!ownerPhone || !/^\+\d{8,15}$/.test(ownerPhone)) throw new Error('Pass --owner-phone in E.164, e.g. +91XXXXXXXXXX');
  const s = loadOrCreateState(pilots, ownerPhone);
  const all = jobs(s);
  const todo = all.slice(s.done, s.done + DAILY_WRITE_BUDGET);
  console.log(`Seed: ${all.length} writes total, ${s.done} done, writing ${todo.length} now (budget ${DAILY_WRITE_BUDGET}/run).`);

  const firestore = db();
  const writer = firestore.bulkWriter();
  let failed: unknown = null;
  writer.onWriteError((e) => {
    failed = e;
    return false; // no retry: likely quota; resume tomorrow
  });
  let ok = 0;
  for (const j of todo) {
    writer.set(firestore.doc(j.path), j.data).then(() => ok++, () => undefined);
  }
  await writer.close();
  // Writes may complete out of order; only advance past a fully successful batch.
  if (!failed) s.done += todo.length;
  saveState(s);
  if (failed) {
    console.error(`Stopped after ${ok} writes: ${(failed as Error).message}. Run again (after the daily quota resets) to continue.`);
    process.exitCode = 1;
    return;
  }
  const left = all.length - s.done;
  console.log(left ? `Done for now. ${left} writes left — run the same command again tomorrow.` : `Seed complete. Owner User ID reserved: ${s.ownerUserId}`);
}

function plan() {
  const p = planSeed(loadMaster(), pilotsArg(), () => newGroupId(cryptoRand));
  const byLevel = (xs: { level: string }[]) =>
    xs.reduce<Record<string, number>>((acc, x) => ((acc[x.level] = (acc[x.level] ?? 0) + 1), acc), {});
  const writes = 2 + p.locations.length + p.groups.length * 2;
  console.log('Locations by level:', byLevel(p.locations));
  console.log('Groups by level:   ', byLevel(p.groups));
  console.log(`Total writes: ${writes} (Spark budget 20,000/day → ${Math.ceil(writes / DAILY_WRITE_BUDGET)} run(s))`);
}

async function deployRules() {
  db();
  const source = readFileSync(join(APP_ROOT, 'firebase/firestore.rules'), 'utf8');
  const ruleset = await getSecurityRules().releaseFirestoreRulesetFromSource(source);
  console.log(`Firestore rules released: ${ruleset.name}`);
}

async function status() {
  const firestore = db();
  for (const c of ['config', 'locations', 'groups', 'id_registry', 'uid_links', 'users', 'accounts']) {
    const snap = await firestore.collection(c).count().get();
    console.log(c.padEnd(12), snap.data().count);
  }
}

const commands: Record<string, () => unknown> = { plan, seed, 'deploy-rules': deployRules, status };
const cmd = process.argv[2];
if (!cmd || !commands[cmd]) {
  console.log('Commands: plan | seed | deploy-rules | status   (see header of tools/ops/src/cli.ts)');
  process.exit(1);
}
Promise.resolve(commands[cmd]()).catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
