"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  pinStatus: () => pinStatus,
  register: () => register,
  setPin: () => setPin,
  verifyPin: () => verifyPin
});
module.exports = __toCommonJS(index_exports);
var import_app = require("firebase-admin/app");
var import_v2 = require("firebase-functions/v2");

// src/register.ts
var import_node_crypto = require("node:crypto");
var import_auth = require("firebase-admin/auth");
var import_firestore = require("firebase-admin/firestore");
var import_params = require("firebase-functions/params");
var import_https = require("firebase-functions/v2/https");

// ../shared/src/zodiac.ts
var ZODIAC_RANGES = [
  { sign: "Aries", element: "Fire", start: "03-21", end: "04-19" },
  { sign: "Taurus", element: "Earth", start: "04-20", end: "05-20" },
  { sign: "Gemini", element: "Air", start: "05-21", end: "06-20" },
  { sign: "Cancer", element: "Water", start: "06-21", end: "07-22" },
  { sign: "Leo", element: "Fire", start: "07-23", end: "08-22" },
  { sign: "Virgo", element: "Earth", start: "08-23", end: "09-22" },
  { sign: "Libra", element: "Air", start: "09-23", end: "10-22" },
  { sign: "Scorpio", element: "Water", start: "10-23", end: "11-21" },
  { sign: "Sagittarius", element: "Fire", start: "11-22", end: "12-21" },
  { sign: "Capricorn", element: "Earth", start: "12-22", end: "01-19" },
  { sign: "Aquarius", element: "Air", start: "01-20", end: "02-18" },
  { sign: "Pisces", element: "Water", start: "02-19", end: "03-20" }
];
function getZodiacSign(dob) {
  const md = parseIsoDate(dob).slice(5);
  for (const z of ZODIAC_RANGES) {
    if (z.start <= z.end) {
      if (z.start <= md && md <= z.end) return z;
    } else if (md >= z.start || md <= z.end) {
      return z;
    }
  }
  return null;
}
function parseIsoDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid ISO date: ${value}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return value;
}

// ../shared/src/ids.ts
var defaultRandomInt = (max) => Math.floor(Math.random() * max);
var USER_ID_DIGITS = 9;
var ACCOUNT_ID_DIGITS = 10;
function randomDigits(digits, rand = defaultRandomInt) {
  let out = String(1 + rand(9));
  for (let i = 1; i < digits; i++) out += String(rand(10));
  return out;
}
var newUserId = (rand) => randomDigits(USER_ID_DIGITS, rand);
var newAccountId = (rand) => randomDigits(ACCOUNT_ID_DIGITS, rand);
var ZODIAC_CODES = {
  Aries: "FA",
  Taurus: "ET",
  Gemini: "AG",
  Cancer: "WC",
  Leo: "FL",
  Virgo: "EV",
  Libra: "AL",
  Scorpio: "WS",
  Sagittarius: "FS",
  Capricorn: "EC",
  Aquarius: "AA",
  Pisces: "WP"
};
function isGender(v) {
  return v === "M" || v === "F" || v === "O";
}
function ageInYears(dob, asOf) {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ay, am, ad] = asOf.split("-").map(Number);
  return ay - by - (am < bm || am === bm && ad < bd ? 1 : 0);
}
function ageType(dob, asOf) {
  const age = ageInYears(dob, asOf);
  if (age <= 24) return "B";
  if (age <= 49) return "Y";
  if (age <= 75) return "V";
  return "S";
}
function nameInitials(name) {
  const parts = (name ?? "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "XX";
  const first = Array.from(parts[0])[0].toUpperCase();
  const lastWord = Array.from(parts.length > 1 ? parts[parts.length - 1] : parts[0]);
  const last = (parts.length > 1 ? lastWord[0] : lastWord[lastWord.length - 1]).toUpperCase();
  return first + last;
}
function serialCode(serial) {
  if (!Number.isInteger(serial) || serial < 1) throw new Error(`Invalid serial: ${serial}`);
  return String(serial).padStart(4, "0");
}
function personCodes(p, asOf) {
  const z = getZodiacSign(p.dob);
  if (!z) throw new Error(`No zodiac sign for ${p.dob}`);
  return {
    initials: nameInitials(p.name),
    gender: p.gender,
    age_type: ageType(p.dob, asOf),
    zodiac_type: z.sign,
    zodiac_code: ZODIAC_CODES[z.sign],
    element: z.element
  };
}
function readableId(codes, serial, locationId) {
  return [codes.initials, serialCode(serial), `G${codes.gender}`, `A${codes.age_type}`, codes.zodiac_code, locationId].join("-");
}

// ../shared/src/tiers.ts
var TIER_LABELS = {
  IND: { zone: "Zone", state: "State", district: "District", tehsil: "Tehsil", village: "Village" },
  NPL: { zone: null, state: "Province", district: "District", tehsil: "Local Level", village: "Ward" },
  BTN: { zone: null, state: "Dzongkhag", district: "Gewog", tehsil: "Chiwog", village: "Village" },
  BGD: { zone: null, state: "Division", district: "District", tehsil: "Upazila", village: "Village" },
  MMR: { zone: null, state: "State / Region", district: "District", tehsil: "Township", village: "Village" },
  LKA: { zone: null, state: "Province", district: "District", tehsil: "DS Division", village: "GN Division" },
  PAK: { zone: null, state: "Province", district: "District", tehsil: "Tehsil", village: "Village" },
  BLC: { zone: null, state: null, district: "District", tehsil: "Tehsil", village: "Village" },
  AFG: { zone: null, state: "Province", district: "District", tehsil: null, village: "Village" },
  MDV: { zone: null, state: null, district: "Atoll", tehsil: "Area", village: "Island" }
};
var SUBCONTINENT_COUNTRIES = {
  IND: { id: "O_AS_IND", name: "India" },
  NPL: { id: "O_AS_NPL", name: "Nepal" },
  BTN: { id: "O_AS_BTN", name: "Bhutan" },
  BGD: { id: "O_AS_BGD", name: "Bangladesh" },
  MMR: { id: "O_AS_MMR", name: "Myanmar" },
  LKA: { id: "O_AS_LKA", name: "Sri Lanka" },
  PAK: { id: "O_AS_PAK", name: "Pakistan" },
  BLC: { id: "O_AS_BLC", name: "Balochistan" },
  AFG: { id: "O_AS_AFG", name: "Afghanistan" },
  MDV: { id: "O_AS_MDV", name: "Maldives" }
};
var SUBCONTINENT_COUNTRY_IDS = Object.values(SUBCONTINENT_COUNTRIES).map((c) => c.id);
function isSubcontinentCountry(countryId) {
  return SUBCONTINENT_COUNTRY_IDS.includes(countryId);
}
function countryCodeOf(countryId) {
  return countryId.split("_").pop() ?? "";
}
function tierLabel(countryCode, level) {
  if (level === "earth") return "Earth";
  if (level === "continent") return "Continent";
  if (level === "country") return "Country";
  return TIER_LABELS[countryCode]?.[level] ?? null;
}

// ../shared/src/groups.ts
var PERSONAL_KINDS = ["family", "friends"];
var MAX_PERSONAL_GROUPS = PERSONAL_KINDS.length;
function hasGroup(countryCode, level) {
  return tierLabel(countryCode, level) !== null;
}

// ../shared/src/posts.ts
var DAY_MS = 24 * 60 * 60 * 1e3;

// ../shared/src/schema.ts
var COL = {
  users: "users",
  accounts: "accounts",
  identities: "identities",
  accountIdentities: "account_identities",
  secrets: "secrets",
  idRegistry: "id_registry",
  counters: "counters",
  locations: "locations",
  groups: "groups",
  requests: "requests",
  chats: "chats",
  elections: "elections",
  revealLog: "reveal_log"
};

// ../shared/src/languages.ts
var LANGUAGE_GROUPS = [
  {
    key: "common",
    label: "Common to everyone",
    languages: [{ name: "English", native: "English" }]
  },
  {
    key: "indian",
    label: "Indian languages",
    languages: [
      { name: "Hindi", native: "\u0939\u093F\u0928\u094D\u0926\u0940" },
      { name: "Urdu", native: "\u0627\u0631\u062F\u0648" },
      { name: "Bengali", native: "\u09AC\u09BE\u0982\u09B2\u09BE" },
      { name: "Marathi", native: "\u092E\u0930\u093E\u0920\u0940" },
      { name: "Telugu", native: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41" },
      { name: "Tamil", native: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD" },
      { name: "Gujarati", native: "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0" },
      { name: "Kannada", native: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1" },
      { name: "Odia", native: "\u0B13\u0B21\u0B3C\u0B3F\u0B06" },
      { name: "Malayalam", native: "\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02" },
      { name: "Punjabi", native: "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40" },
      { name: "Assamese", native: "\u0985\u09B8\u09AE\u09C0\u09AF\u09BC\u09BE" }
    ]
  },
  {
    key: "subcontinent",
    label: "Other Indian Sub-continent languages",
    languages: [
      { name: "Pashto", native: "\u067E\u069A\u062A\u0648" },
      { name: "Sindhi", native: "\u0633\u0646\u068C\u064A" },
      { name: "Saraiki", native: "\u0633\u0631\u0627\u0626\u06CC\u06A9\u06CC" },
      { name: "Nepali", native: "\u0928\u0947\u092A\u093E\u0932\u0940" },
      { name: "Burmese", native: "\u1019\u103C\u1014\u103A\u1019\u102C" },
      { name: "Sinhala", native: "\u0DC3\u0DD2\u0D82\u0DC4\u0DBD" },
      { name: "Dari", native: "\u062F\u0631\u06CC" },
      { name: "Balochi", native: "\u0628\u0644\u0648\u0686\u06CC" },
      { name: "Dzongkha", native: "\u0F62\u0FAB\u0F7C\u0F44\u0F0B\u0F41" },
      { name: "Dhivehi", native: "\u078B\u07A8\u0788\u07AC\u0780\u07A8" }
    ]
  }
];
var LANGUAGE_NAMES = LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => l.name));
var isLanguage = (name) => typeof name === "string" && LANGUAGE_NAMES.includes(name);

// ../shared/src/profile.ts
function validateProfile(p, today) {
  const errors = {};
  const name = (p.name ?? "").trim();
  if (name.length < 2 || name.length > 80) errors.name = "Enter your full name (2\u201380 characters).";
  if (!isGender(p.gender)) errors.gender = "Choose Male, Female or Other.";
  try {
    parseIsoDate(p.dob ?? "");
    if ((p.dob ?? "") > today) errors.dob = "Date of birth cannot be in the future.";
    else if ((p.dob ?? "") < "1900-01-01") errors.dob = "Enter a date after 1900.";
  } catch {
    errors.dob = "Enter a valid date of birth.";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.tob ?? "")) errors.tob = "Enter time of birth as HH:MM (24-hour).";
  if (!isLanguage(p.language)) errors.language = "Choose your mother tongue.";
  return errors;
}
var PIN_LOCK_AFTER = 5;
var PIN_OTP_AFTER = 10;
var PIN_LOCK_MINUTES = 15;
function pinProblem(pin) {
  if (!/^\d{5}$/.test(pin)) return "PIN must be exactly 5 digits.";
  if (/^(\d)\1{4}$/.test(pin)) return "Avoid repeating one digit.";
  if ("0123456789".includes(pin) || "9876543210".includes(pin)) return "Avoid simple sequences like 12345.";
  return null;
}

// src/chain.ts
function buildChain(path) {
  const countryId = path.find((l) => l.level === "country")?.id ?? null;
  const code = countryId ? countryCodeOf(countryId) : "";
  const chain = {};
  const missing = [];
  for (const loc of path) {
    if (!hasGroup(code, loc.level)) continue;
    if (loc.group_id) chain[loc.level] = loc.group_id;
    else missing.push(loc.level);
  }
  return { chain, missing, countryId };
}
function presentLocationProblem(leaf, countryId) {
  if (!leaf) return "Present location not found.";
  if (!countryId || !isSubcontinentCountry(countryId)) {
    return "Present location must be in one of the 10 Indian Sub-continent countries.";
  }
  if (leaf.has_children) return "Choose your present location down to the village.";
  return null;
}
function birthLocationProblem(leaf, countryId) {
  if (!leaf) return "Birth location not found.";
  if (!countryId) return "Choose at least your birth country.";
  if (isSubcontinentCountry(countryId) && leaf.has_children) return "Choose your birth location down to the village.";
  return null;
}

// src/register.ts
var OWNER_PHONE = (0, import_params.defineString)("OWNER_PHONE", { description: "Mentor (owner) phone number in E.164, e.g. +91XXXXXXXXXX" });
var cryptoRand = (max) => (0, import_node_crypto.randomInt)(max);
async function locationPath(db, id) {
  const path = [];
  let next = id;
  for (let depth = 0; next && depth < 10; depth++) {
    const snap = await db.collection(COL.locations).doc(next).get();
    if (!snap.exists) break;
    const loc = snap.data();
    path.push(loc);
    next = loc.parent_id;
  }
  return path;
}
function toRef(path, countryId) {
  const leaf = path[0];
  return { id: leaf.id, name: leaf.name, level: leaf.level, country_id: countryId };
}
async function reserveNumber(tx, db, make) {
  const refs = Array.from({ length: 5 }, () => db.collection(COL.idRegistry).doc(make()));
  const snaps = await tx.getAll(...refs);
  const free = snaps.find((s) => !s.exists);
  if (!free) throw new import_https.HttpsError("aborted", "Could not allocate an ID, please retry.");
  return free.ref;
}
var register = (0, import_https.onCall)(async (req) => {
  const authUid = req.auth?.uid;
  const phone = req.auth?.token.phone_number;
  if (!authUid || !phone) throw new import_https.HttpsError("unauthenticated", "Sign in with your phone number first.");
  const db = (0, import_firestore.getFirestore)();
  const input = req.data ?? {};
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const errors = validateProfile(input, today);
  if (Object.keys(errors).length) throw new import_https.HttpsError("invalid-argument", "Please fix the highlighted fields.", { errors });
  const secret = await db.collection(COL.secrets).doc(authUid).get();
  if (!secret.exists || !secret.get("hash")) throw new import_https.HttpsError("failed-precondition", "Create your 5-digit PIN first.");
  const [birthPath, presentPath] = await Promise.all([
    locationPath(db, String(input.birthLocationId ?? "")),
    locationPath(db, String(input.presentLocationId ?? ""))
  ]);
  const birth = buildChain(birthPath);
  const present = buildChain(presentPath);
  const problem = birthLocationProblem(birthPath[0], birth.countryId) ?? presentLocationProblem(presentPath[0], present.countryId);
  if (problem) throw new import_https.HttpsError("invalid-argument", problem);
  const isOwner = phone === OWNER_PHONE.value();
  if (!isOwner) {
    if (present.missing.length) throw new import_https.HttpsError("failed-precondition", "Your location groups are not open yet.");
    const groups = await db.getAll(...Object.values(present.chain).map((g) => db.collection(COL.groups).doc(g)));
    if (groups.some((g) => !g.exists || g.get("is_active") !== true)) {
      throw new import_https.HttpsError("failed-precondition", "Your location groups are not active yet.");
    }
  }
  const codes = personCodes(input, today);
  const birthLoc = toRef(birthPath, birth.countryId);
  const presentLoc = toRef(presentPath, present.countryId);
  const linkRef = db.collection("auth_links").doc(authUid);
  const birthCounter = db.collection(COL.counters).doc(birthLoc.id);
  const presentCounter = db.collection(COL.counters).doc(presentLoc.id);
  const result = await db.runTransaction(async (tx) => {
    const link = await tx.get(linkRef);
    if (link.exists) throw new import_https.HttpsError("already-exists", "This phone number is already registered.");
    const [birthC, presentC] = await tx.getAll(birthCounter, presentCounter);
    const userRef = await reserveNumber(tx, db, () => newUserId(cryptoRand));
    const accountRef = await reserveNumber(tx, db, () => newAccountId(cryptoRand));
    const sameVillage = birthLoc.id === presentLoc.id;
    const bornSerial = (birthC.get("born_serial") ?? 0) + 1;
    const residentSerial = (presentC.get("resident_serial") ?? 0) + 1;
    const userId = userRef.id;
    const accountId = accountRef.id;
    const now = import_firestore.FieldValue.serverTimestamp();
    tx.set(userRef, { kind: "user", ref: userId, created_at: now });
    tx.set(accountRef, { kind: "account", ref: userId, created_at: now });
    if (sameVillage) {
      tx.set(birthCounter, { born_serial: bornSerial, resident_serial: residentSerial }, { merge: true });
    } else {
      tx.set(birthCounter, { born_serial: bornSerial }, { merge: true });
      tx.set(presentCounter, { resident_serial: residentSerial }, { merge: true });
    }
    const user = {
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
      created_at: now
    };
    tx.set(db.collection(COL.users).doc(userId), user);
    const account = {
      account_id: accountId,
      display_name: input.name.trim(),
      photo_url: null,
      village_name: presentLoc.name,
      village_group: present.chain.village ?? null,
      active: true,
      created_at: now
    };
    tx.set(db.collection(COL.accounts).doc(accountId), account);
    tx.set(db.collection(COL.identities).doc(userId), {
      readable_id: readableId(codes, bornSerial, birthLoc.id),
      user_id: userId,
      serial: bornSerial,
      location_id: birthLoc.id,
      codes,
      created_at: now
    });
    tx.set(db.collection(COL.accountIdentities).doc(accountId), {
      readable_id: readableId(codes, residentSerial, presentLoc.id),
      user_id: userId,
      serial: residentSerial,
      location_id: presentLoc.id,
      created_at: now
    });
    tx.set(linkRef, { user_id: userId, created_at: now });
    for (const groupId of Object.values(present.chain)) {
      tx.set(db.collection(COL.groups).doc(groupId), { user_count: import_firestore.FieldValue.increment(1) }, { merge: true });
    }
    return { userId, accountId };
  });
  await (0, import_auth.getAuth)().setCustomUserClaims(authUid, {
    qid: result.userId,
    acc: result.accountId,
    chain: present.chain,
    ...isOwner ? { owner: true } : {}
  });
  return result;
});

// src/pin.ts
var import_auth2 = require("firebase-admin/auth");
var import_firestore2 = require("firebase-admin/firestore");
var import_https2 = require("firebase-functions/v2/https");

// src/pinHash.ts
var import_node_crypto2 = require("node:crypto");
var import_node_util = require("node:util");
var scrypt = (0, import_node_util.promisify)(import_node_crypto2.scrypt);
var KEY_LEN = 32;
var PARAMS = { N: 16384, r: 8, p: 1 };
async function hashPin(pin) {
  const salt = (0, import_node_crypto2.randomBytes)(16);
  const key = await scrypt(pin, salt, KEY_LEN, PARAMS);
  return { hash: key.toString("base64"), salt: salt.toString("base64"), algo: "scrypt-16384-8-1" };
}
async function checkPin(pin, stored) {
  const key = await scrypt(pin, Buffer.from(stored.salt, "base64"), KEY_LEN, PARAMS);
  const expected = Buffer.from(stored.hash, "base64");
  return expected.length === key.length && (0, import_node_crypto2.timingSafeEqual)(expected, key);
}

// src/pin.ts
function requireAuth(uid) {
  if (!uid) throw new import_https2.HttpsError("unauthenticated", "Sign in with your phone number first.");
  return uid;
}
var setPin = (0, import_https2.onCall)(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const pin = String(req.data?.pin ?? "");
  const problem = pinProblem(pin);
  if (problem) throw new import_https2.HttpsError("invalid-argument", problem);
  const ref = (0, import_firestore2.getFirestore)().collection(COL.secrets).doc(uid);
  const snap = await ref.get();
  if (snap.exists && snap.get("hash")) {
    const ok = await checkPin(String(req.data?.currentPin ?? ""), snap.data());
    if (!ok) throw new import_https2.HttpsError("permission-denied", "Current PIN is wrong.");
  }
  await ref.set({ ...await hashPin(pin), failed: 0, locked_until: null, updated_at: import_firestore2.FieldValue.serverTimestamp() });
  return { ok: true };
});
var verifyPin = (0, import_https2.onCall)(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const db = (0, import_firestore2.getFirestore)();
  const ref = db.collection(COL.secrets).doc(uid);
  const snap = await ref.get();
  if (!snap.exists || !snap.get("hash")) throw new import_https2.HttpsError("failed-precondition", "No PIN set yet.");
  const lockedUntil = snap.get("locked_until");
  if (lockedUntil && lockedUntil.toMillis() > Date.now()) {
    return { ok: false, lockedUntil: lockedUntil.toDate().toISOString() };
  }
  if (await checkPin(String(req.data?.pin ?? ""), snap.data())) {
    await ref.update({ failed: 0, locked_until: null });
    return { ok: true };
  }
  const failed = (snap.get("failed") ?? 0) + 1;
  if (failed >= PIN_OTP_AFTER) {
    await ref.update({ failed: 0, locked_until: import_firestore2.Timestamp.fromMillis(Date.now() + PIN_LOCK_MINUTES * 6e4) });
    await (0, import_auth2.getAuth)().revokeRefreshTokens(uid);
    return { ok: false, otpRequired: true };
  }
  if (failed % PIN_LOCK_AFTER === 0) {
    const until = import_firestore2.Timestamp.fromMillis(Date.now() + PIN_LOCK_MINUTES * 6e4);
    await ref.update({ failed, locked_until: until });
    return { ok: false, lockedUntil: until.toDate().toISOString() };
  }
  await ref.update({ failed });
  return { ok: false, triesLeft: PIN_LOCK_AFTER - failed % PIN_LOCK_AFTER };
});
var pinStatus = (0, import_https2.onCall)(async (req) => {
  const uid = requireAuth(req.auth?.uid);
  const snap = await (0, import_firestore2.getFirestore)().collection(COL.secrets).doc(uid).get();
  return { hasPin: snap.exists && !!snap.get("hash") };
});

// src/index.ts
(0, import_app.initializeApp)();
(0, import_v2.setGlobalOptions)({ region: "asia-south1", maxInstances: 20 });
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  pinStatus,
  register,
  setPin,
  verifyPin
});
