# Website → App Migration Plan

**Created 2026-11-08**, from a live, evidence-based inventory of both repositories (not assumed
from prior docs). Source: `~/Desktop/Qumanity_DPG` (Flask website/backend). Destination: this
repo, `~/Desktop/Qumanity_App` (Expo/React Native mobile app). The single most important fact
this plan rests on: **the app is, and must remain, another client of the website's own `/api/...`
routes — there is no separate backend, no separate identity system, and no separate governance
system.** `docs/phone_app_api.md` in this repo is the living, actively-maintained contract of what
already works; this document is the planning layer on top of it — read that file first for route
details, this file for what's left, what's risky, and in what order to do it.

---

## 1. Project architecture comparison

| | Website (`Qumanity_DPG`) | Mobile app (`Qumanity_App`) |
|---|---|---|
| Stack | Flask + SQLite, server-rendered HTML + vanilla JS | Expo SDK 58 (managed), React 19.3, React Native 0.88, TypeScript, expo-router (file-based) |
| Auth | Session cookie (browser) **or** signed Bearer token (`client:"app"`) | Bearer token only, stored in `expo-secure-store` (Keychain/Keystore) |
| State | Server session + page JS | Plain React Context (`src/state/app.tsx`) — no Redux/Zustand/React Query |
| Styling | `static/css/*.css`, a "Cosmic" saffron/gold-on-navy theme | `src/theme/index.ts` — already matches the website's Cosmic palette and elemental colors |
| Identity | 9-digit Private ID + 5-char PIN, server-minted | Same — no client-side ID minting in the **live** app (see §6's `shared/` warning) |
| Geography | `subcontinent_states.json` / `subcontinent_districts.json` / `india_villages` DB table / `global_countries.json` | Consumes the same JSON via `/api/subcontinent*`, `/api/world-data`, `/api/india-villages/<id>` — no separate copy |
| Tests | 31 files / 1,286 checks (`tests/*.py`) | 3 `vitest` unit files (thin) + a 115-check cross-repo integration suite (`tools/website-check/check_app_api.py`) that is the real confidence source for the API contract |

**Finding**: the app is **not** a blank slate. Registration (both Public and Global Account
screens), boards/voting, Q-Punch council + volunteer seats, election history, a Family Tree
activation wizard, wallet, personal groups/chat, account-ID switching, India scoreboard, Founder's
Message, and an onboarding tour already have real, working screens. This changes the shape of the
work from "build everything" to "reconcile and extend what's there, feature by feature."

---

## 2. Website feature inventory

Full 23-area table with modules, routes, DB tables, auth/account-type rules, and test coverage is
below in §4 (combined with the app-side status, to avoid a feature appearing twice). The
freestanding research behind it covered: registration, auth/session, Public vs Global Accounts,
dashboard/profile, Present/Birth Location, geography hierarchy, profile-change requests + Admin
approval, Family Tree, the four timelines/boards, reactions/visibility, Global Page voting,
Q-Punch elections, Q-Punch eligibility/rewards, collective boards, referrals (two separate
systems — see below), wallet/Qoins/Karma, notifications, Qmail/email, Q-Map, GPS/location consent,
astronomy, Admin Panel, and incidental features (Cosmic homepage, Founder's Message, i18n,
Perception Calculator, scoreboard/tutorial, Election History).

**Three things worth calling out before the matrix**, because they change how several rows should
be read:

- **"Q-Punch" names three unrelated things in this codebase.** (1) `election_core.py` — the real
  Village Council election (nomination → voting → winners), piloted on exactly one village,
  `PILOT_VILLAGE_ID = "CS.DL.3.4.1A"` (Rohini Sector 24). (2) `qmail_core.py`'s
  `QPUNCH_REACHABLE_LEVELS = {"village"}` — a council-mail *reachability* rule, unrelated to
  voting. (3) `board_core.py`'s `register_volunteer()` / `volunteers` table, served at
  `GET /api/qpunch/<level>` and `POST /api/qpunch/volunteer` — a lightweight, ungated
  "volunteer/agent" self-registration per geography level (Village through Earth), which only
  *nests* the real election data inside it when `level=="village"` and the group is the pilot
  village. The app's `council.tsx`/`QPunchSheet.tsx` already call all three correctly in practice
  (confirmed by the inventory), but anyone extending this screen must know these are three
  different mechanisms, not one feature with three names.
- **Referrals are two separate, non-interoperating systems.** (a) Registration-time attribution
  (`referred_by_public_id` / assisted-registration helper) — committed, tested, and already used
  by the app's registration flow. (b) A board-level "become a referrer" application
  (`/api/referrer/apply`, `/me`) — implemented and already called by the app
  (`docs/phone_app_api.md`'s "Dashboard parity calls"), but **has no redemption path on the
  backend** (confirmed unfinished, not just undocumented). Do not build a mobile screen that
  implies referrer codes can be redeemed for anything yet.
- **The Global Account feature is real but uncommitted on the website side as of this writing.**
  `account_core.py`, the Public/Global registration split, and the Dashboard tab-hiding logic all
  exist and pass 108 dedicated tests in `Qumanity_DPG` — but `git status` there shows it entirely
  uncommitted, awaiting the website owner's separate authorization to commit. The app's
  `register/global.tsx` screen already exists. **Before any further mobile work on Global Account
  registration, explicitly verify `register/global.tsx`'s request payload against the website's
  *current* (uncommitted) `api_auth_register()` validation branch** — they were built on different
  timelines and may not agree on field shape yet. This is flagged again in §9 as the recommended
  first task.

---

## 3. Mobile application inventory

See the live, verified findings — tech stack, navigation, state management, API client, auth/token
storage, backend URL config, styling, permissions, GPS, push, offline, tests, and build
configuration — summarized in §4's "Mobile app status" column and in the narrative notes below.
Full detail (file-by-file) was gathered this session by direct inspection; the highlights that
matter for planning:

- **Auth is already done correctly.** Bearer token in `expo-secure-store` (not `AsyncStorage`),
  production always points at `https://qumanity.in` regardless of `.env` (a `.env` override only
  applies in `__DEV__`), and `/api/me`'s response — not a locally-decided flag — is the only
  source of account classification (`src/state/app.tsx`'s `me`). This already satisfies the
  platform's hardest identity/authorization requirement.
- **No GPS/location implementation exists at all** — no `expo-location` dependency, zero usage in
  `src/`. `LocationPicker.tsx`/`SubcontinentMap.tsx` are manual-selection UI only. This means the
  website's OSM-proximity feature (consent-gated personal-location layer on Q-Map) has **zero**
  mobile counterpart today and would need to be built from scratch, including a consent UI that
  matches the backend's three-flag versioned consent model (`consent_internal_storage`,
  `consent_centroid_aggregation`, `consent_external_overpass_lookup`, `consent_version` —
  `osm_proximity_core.py`).
- **No push notifications** — polling only (chats refresh every 4s; boards refresh on open). This
  is an explicitly documented, known gap in this repo's own `docs/TESTING_GUIDE.md`, not a new
  finding.
- **`shared/src/ids.ts` and `shared/src/elections.ts` are dead code, but risky-looking.** They
  reimplement server-side ID-minting and a speculative multi-tier council-election model (from the
  parked Firebase design in `docs/DEVELOPMENT_PLAN.md` §17/§21) that does **not** match what the
  real backend implements (one pilot village, not a full Village→Earth council ladder). Confirmed
  by import-graph check: nothing in the live `mobile/src/` app imports the minting or election
  logic from `shared/` (only a static `LANGUAGE_GROUPS` list is used). **Do not wire these back in
  for anything live.** If the parked Firebase path is ever revived, treat this as a hazard to
  remove, not a resource to reuse.
- **`docs/phone_app_api.md`'s own numbers are mildly stale.** It states the checker "runs 87
  checks"; running it fresh this session shows 115 checks (3 currently failing — see §6). Update
  that line whenever this plan's findings are reconciled back into it.

---

## 4. Feature migration matrix

Legend — **Website**: ✅ Implemented & committed · ⚠️ Implemented, uncommitted or confirmed
vulnerable · 🔴 Known incomplete. **App**: ✅ Screen + working integration · 🟡 Screen exists, not
fully verified against current backend · ❌ Not built. **API**: Available / Incomplete / Missing.

| # | Feature | Website status | App status | API available? | Backend changes needed? | Mobile work needed | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|
| 1 | Registration (Public + Global) | ⚠️ Global Account still uncommitted on the website | ✅ `register/{public,global}.tsx` — Global Account path implemented 2026-11-08 (Phase 2), verified end-to-end | Available (Public); Available-but-uncommitted (Global) | None for Public; **owner must commit Global Account work** | Done | Account classification | Done (app side); tracking website commit |
| 2 | Login/logout/session | ✅ | ✅ | Available (bearer-token flow already built for the app) | None | None | — | Done |
| 3 | Public vs Global Account classification | ⚠️ Global Account still uncommitted; ancestry-validation bug **fixed** (Phase 1) | ✅ consumed via `/api/me`'s `is_global_account` (now typed; Public tab hidden accordingly) | Available | Done | Done | — | Done (app side) |
| 4 | Dashboard/profile | ✅ | ✅ (`(tabs)/*`, `settings.tsx`) | Available | None | None | — | Done |
| 5 | Present/Birth Location | ✅ ancestry fix (Phase 1) + registration-Village fix (corrective follow-up) | ✅ `LocationPicker.tsx` — now used worldwide for BOTH birth and present location (registration time) | Available | Done | Done (registration); editing present_location post-registration is Phase 2b, still pending | #3 | Done (registration); Phase 2b pending |
| 6 | Geography hierarchy | ✅ | ✅ (`src/api/locations.ts`) | Available | None | None | — | Done |
| 7 | Profile-change requests + Admin approval | ⚠️ Same ancestry bug | 🟡 `profile-change.tsx` exists, calls `/api/dashboard/edit-request` | Incomplete (same gap) | Same fix as #3 | Blocked | #3 | **Blocker** |
| 8 | Family Tree | ✅ | ✅ full 6-step activation wizard already built, incl. regression cases | Available | None | None — already in sync as of 2026-10-26 | — | Done |
| 9 | Timelines/Boards (all 4) | ✅ | ✅ `(tabs)/{global,public,personal,private}.tsx` | Available | None | None | #3 (Global tab visibility) | Done |
| 10 | Reactions/visibility | ✅ | 🟡 not explicitly inventoried this pass | Available | None | Verify reaction UI calls `/api/reactions/<scope>/<id>` | Boards | Medium |
| 11 | Global Page voting | ✅ | ✅ via Board screens | Available | None | None | #9 | Done |
| 12 | Q-Punch elections (real) | ✅ gate correct; **winner-tally display confirmed broken** | 🟡 `election-history.tsx`, `ElectionCard.tsx` | Incomplete (`election_summary()` returns `winners:{male:null,female:null,...}` even after real votes close) | **Yes — fix `election_summary()`'s winner computation** | Blocked for the "winners" view specifically; nomination/voting themselves are fine | — | **Blocker (narrow)** |
| 13 | Q-Punch eligibility/rewards | ✅ gate correct (`account_core`-based, tested) | — | Available | None (gate itself is sound) | None | #3's upstream validator | Done (gate); watch #3 |
| 14 | Q-Punch volunteer/agent seats | ✅ (separate from #12 — see §2) | ✅ `QPunchSheet.tsx`, `council.tsx` | Available | None | None | — | Done |
| 15 | Collective Boards (paid tiers) | ✅ | 🟡 not separately inventoried | Available | None | Verify paid-tier UI (Tehsil–Zone) matches `PAID_LEVELS` | #9 | Medium |
| 16a | Referrals — registration attribution | ✅ | ✅ "Referred By (Public ID)" in registration | Available | None | None | — | Done |
| 16b | Referrals — board-level referrer application | 🔴 no redemption path | ✅ calls `/api/referrer/apply`/`/me` | Available but leads nowhere | **Decide product direction before building redemption UI** | Do not imply redemption works | — | Low / blocked on product decision |
| 17 | Wallet/Qoins/Karma | ✅ | ✅ `wallet.tsx` | Available | None | None | — | Done |
| 18 | Notifications (in-app) | ✅ narrow scope (chats + people-requests only) | ✅ `notifications.tsx`, polling | Available | None | Scope is already correctly narrow — don't over-build | — | Done |
| 19 | Push notifications | N/A (web has none either) | ❌ not built, no `expo-notifications` | N/A | N/A | Build from scratch if prioritized | Device permission plan | Future |
| 20 | Qmail/email | ✅ | — not inventoried this pass (not seen in screen list) | Available | None | **If built**: must port the whitelist-markup renderer faithfully, never a generic HTML view (security-relevant — the website deliberately has no sanitizer, relying on a fixed whitelist renderer) | — | Medium-low |
| 21 | Q-Map (public base map) | ✅ | ❌ not found | Available | None | New screen; base map is public, no consent needed | — | Medium |
| 22 | Q-Map personal-proximity layer + GPS consent | ✅ | ❌ **no GPS implementation at all** | Available | None | Build from scratch: `expo-location` + a 3-flag versioned-consent UI matching `osm_proximity_core.py` exactly | #21 | Future, needs its own careful pass |
| 23 | Astronomy (zodiac/Kundali/lunar) | ✅ | ✅ `sky.tsx`, `/api/me/kundali` | Available | None | None | — | Done |
| 24 | Admin Panel | ✅ (council-scoped) | N/A | Available | None | **Not applicable to mobile** per existing scope decision | — | Not applicable |
| 25 | Cosmic homepage / i18n / Founder's Message / scoreboard / tutorial | ✅ | 🟡 Founder's Message, scoreboard, tour all have app screens; homepage itself is web-presentation, not applicable | Available | None | i18n: confirm `/api/user/languages` + the 12-language set match what `settings.tsx` offers | — | Low |

---

## 5. Shared backend contracts

**Identity and authentication.** The app authenticates exactly as `docs/phone_app_api.md` §"Sign-in
for the app" describes: `POST /login` or `POST /api/auth/register` with `client:"app"` returns a
signed (`itsdangerous`, not JWT) Bearer token good for 30 days, fingerprinted to the current PIN
hash so a PIN change invalidates every old token. Every other `/api/*` route is unchanged — the
`before_request` hook that verifies the Bearer header sets `session["user_id"]` exactly as a
browser session would, so no route needs app-specific branches. **Already correctly implemented**
on the app side: token lives in `expo-secure-store`, never `AsyncStorage`; `/api/me`'s response,
not a client-side decision, is the only source of account type. No changes needed here.

**Geography.** `Village → Tehsil → District → State → Zone → Country → Continent → Earth`, IDs are
stable dotted strings (e.g. `CS.DL.3.4.1A`), sourced from `subcontinent_states.json` /
`subcontinent_districts.json` / the `india_villages` DB table (which, despite its name, holds
verified village rows for **all 9** Subcontinent countries, not just India — confirmed by
per-country row counts) / `global_countries.json` for the other 229 countries. The app must keep
fetching these from the live `/api/subcontinent*`, `/api/world-data`, `/api/india-villages/<id>`
endpoints — never bundle a local copy, never invent an ID scheme, never deduplicate or renumber.

**Public vs Global Accounts.** Classification is derived server-side, live, from
`present_location.country.id ∈ SUBCONTINENT_COUNTRY_IDS` (`account_core.py`) — never a persisted
column, never trusted from a client flag. The app must keep doing exactly what it already does:
read `is_global_account` (or whatever `/api/me` exposes) from the server response and branch UI on
that, never decide it locally from the location the user picked in the registration wizard.

**Consent and privacy.** GPS/location consent is a three-flag, versioned record
(`consent_internal_storage`, `consent_centroid_aggregation`, `consent_external_overpass_lookup`,
`consent_version`) — a wording change requires fresh re-confirmation, never retroactive reuse of an
old consent. **A device permission (iOS/Android location permission) is not a substitute for this
record** — the app must still call the backend's own consent-recording endpoint before any GPS
data is sent, exactly mirroring the website's own rule. Profile picture serving already correctly
respects `hide_identity` (family-only vs 404 for everyone else) — any new feature exposing
user-generated content must check the same flag server-side, not hide it only in the UI.

**Q-Punch vs Global Page voting.** These are different systems and must stay visually and
functionally distinct in the app, exactly as `docs/phone_app_api.md` and `Qumanity_DPG`'s own
`docs/HANDOVER.md` describe: Q-Punch (`election_core.py`) is the one-village-pilot Council
election, gated on residency + age + zodiac-sign-of-the-month; Global Page voting (`+1/0/-1` on
Country/Continent/Earth board posts) is a completely separate mechanism with its own geography
scoping (country-level = that country's residents only; continent-level = shared by continent;
Earth = universal). Do not let a UI refactor blur the two, and do not implement any election-rule
logic client-side — `shared/src/elections.ts`'s speculative multi-tier model must **not** be used
as a reference for real behavior.

---

## 6. Security and privacy requirements — current blockers

> **Status update (2026-11-08, Phase 1 + corrective follow-up): all three items below are now
> fixed and verified**, including the registration-side Village-validation gap a later
> owner-approval audit found (registration had never queried `india_villages` at all — closed by
> reusing the existing `verified_village_exists()` helper). Full regression: 32 backend test
> files / 1,339 checks / 0 failures; `tools/website-check/check_app_api.py` against a live copy
> of the real database shows 0 failures on all three items (only the separately-tracked, unrelated
> Board failure remains). The findings below are kept as the historical record of what was found
> and why — not a currently-accurate "still broken" status.

**Unresolved, confirmed (re-verified this session, code read directly — not assumed from a prior
report): `app.py`'s `_validate_present_location_change()` has a real ancestry-validation gap.**
Submitting a `tehsil` + `village` pair while omitting `district` entirely skips the
tehsil-belongs-to-district check (the code only runs that check when a `district` was also
submitted). Demonstrated end-to-end this session: a user genuinely registered in Karnataka, by
submitting a profile-change request naming the real pilot village's tehsil+village ids with no
district, had `_validate_present_location_change()` return `(True, "")` and — once applied —
`_present_village_id()` resolved to exactly `PILOT_VILLAGE_ID`, meaning an Admin who approved that
ticket (believing it had passed validation) would have granted real Q-Punch nomination/voting
eligibility for Rohini Sector 24 to someone with no genuine connection to it. **This is not fixed
as of this writing.** The recommended backend correction (narrowly scoped, not yet implemented):
require and validate `district_id` whenever `tehsil_id` is submitted, rather than silently skipping
the check when `district` is missing.

**Consequence for mobile work**: any mobile screen that can submit or modify Present Location —
today that's `register/public.tsx` (full registration), `register/global.tsx` (Global
registration, country-only so less exposed but still routes through the same account-boundary
logic), `profile-change.tsx` (`/api/dashboard/edit-request`), and `LocationPicker.tsx` wherever it
feeds either of those — is **blocked from shipping any new present-location-editing capability
until the backend fix lands and is re-tested**. Registration itself is lower-risk (it has always
required a `state`, and never validated district/tehsil/village ancestry at all — a separate,
older, already-documented limitation, not newly discovered), but the **profile-change-request path
is the confirmed-exploitable one** and must not be extended on the mobile side in its current
state.

**Two previously-flagged API-contract items, verified live this session (not assumed):**

1. **"Does the registration response include a `donation` object?"** — **Confirmed: no, and this
   is current.** Running `tools/website-check/check_app_api.py` fresh against a disposable copy of
   the real database: `FAIL self-registration is free: account made, nothing to pay, free Qoin
   minted [(201, None, None)]` — registration succeeds (201, no error) but the response has no
   `"donation"` key at all. This is **not a functional break** (the free Qoin is still minted via
   `wallet_core.apply_free_registration`; registration works) — it's a stale assertion in the
   checker script (and, by extension, in any mobile UI that might expect a `donation.kind=="free"`
   marker to show a "your registration included a free Qoin" message). Low severity; narrowly
   scoped fix is either add the marker field to the response, or update the checker/docs to drop
   the expectation — a product decision, not urgent.
2. **"Does the election winner-tally display issue remain unresolved?"** — **Confirmed yes, and
   it's a real backend bug, not a display-only issue.** Same live run:
   `FAIL week 4: winners have the most votes [({'male': None, 'female': None, 'male_votes': 0,
   'female_votes': 0, ...}, {'male': 15, 'female': 11})]` — after a full simulated Libra cycle
   closes with real votes cast (15 male, 11 female), `election_summary()`'s `winners` object comes
   back with `male`/`female` both `None` and both vote counts `0`. **This blocks reliable "winner"
   UI on mobile** (`ElectionCard.tsx`, `election-history.tsx`) — the underlying computation, not
   just a rendering choice, needs a backend fix before this specific view can be trusted.

Neither of these two items should be "fixed" independently on the mobile side — both need a
backend correction (or, for the donation marker, a documented product decision) first.

---

## 7. API gaps and dependencies

- **GPS/location consent + proximity**: no mobile implementation exists; needs `expo-location`,
  a permission-request flow, and a consent UI mirroring the backend's 3-flag model exactly — see
  §6/§3. The backend API itself (`osm_proximity_core.py`'s routes) is available; nothing new is
  needed there.
- **Push notifications**: no backend gap (the website has none either) but no mobile
  implementation; `expo-notifications` + a device-token-registration endpoint would need to be
  added to the backend if this is prioritized — currently out of scope for parity, since parity
  with the website doesn't require it.
- **Q-Punch winner display**: backend gap, see §6.
- **Present-location ancestry validation**: backend gap, see §6 — the single biggest blocker for
  any further location-editing mobile work.
- **Referrer redemption (16b)**: product-level gap on the backend, not a mobile-side problem to
  solve.

---

## 8. Proposed mobile architecture

**The existing structure is already suitable — preserve it.** `src/app/` (expo-router, file-based),
`src/components/`, `src/api/` (a thin `client.ts` fetch wrapper + a single typed `qumanity.ts`
module with ~60 backend-call functions + `locations.ts`), `src/state/app.tsx` (Context-based
account/session state), and `src/theme/index.ts` (the Cosmic design tokens) together already match
every pattern this plan would otherwise recommend: one API module per backend concern, server-driven
account/permission state (never client-decided), and a design system already aligned with the
website's branding. No restructuring is recommended. Two narrow, additive suggestions only:

1. When GPS/location work begins (§7), give it its own `src/api/location.ts` (mirroring the
   existing `locations.ts`/geography split by name, so "geography selection" and "device GPS /
   consent" stay visibally separate modules, matching the backend's own `osm_proximity_core.py`
   being a separate module from the geography JSON/DB).
2. Treat `shared/src/ids.ts` and `shared/src/elections.ts` as explicitly deprecated-for-mobile-use
   in any contributor-facing note — they are not part of this architecture going forward.

---

## 9. Recommended implementation order

Dependency-aware, not website-navigation-order. Each phase is independently reviewable/testable.

### Phase 0 (do first, before any new feature work): reconcile Global Account registration
- **Features**: none new — verify `register/global.tsx`'s actual request payload against
  `Qumanity_DPG`'s current (uncommitted) `api_auth_register()` Global-Account validation branch.
- **Backend contract**: `POST /api/auth/register` with a Global-shaped `present_location`
  (continent + country only, no subordinate fields).
- **Mobile work**: none, unless the reconciliation finds a mismatch.
- **Dependencies**: the website owner's decision on when to commit the Global Account work.
- **Security**: none beyond what's already audited on the website side.
- **Automated tests**: re-run `tools/website-check/check_app_api.py` after any payload change.
- **Manual verification**: one real Global registration (e.g. a Japan or Kenya present location)
  through the app against a local dev copy of the website.
- **Definition of done**: a Global registration through the app produces the exact same
  `present_location_json` shape the website's own 108 Global-Account tests expect.

### Phase 1: backend correctness fixes (blocking, not mobile work at all)
- Fix `_validate_present_location_change()`'s district-omission gap (§6).
- Fix `election_summary()`'s winner computation (§6).
- Resolve the donation-marker discrepancy (§6) — either add the field or update the checker/docs.
- **Definition of done**: `tools/website-check/check_app_api.py` run against a fresh copy shows 0
  failures, and the website's own `_validate_present_location_change` gets the narrowly-scoped
  district-requirement fix, re-tested.

### Phase 2 (2026-11-08, completed): Global Account registration in the mobile app
**Note on numbering**: this is a different piece of work from the "Phase 2" originally planned
below ("unblock present-location editing in the app," i.e. editing present_location *after*
registration via `profile-change.tsx`) — that work is unchanged and still pending; see its own
entry just below, now effectively "Phase 2b." This entry is the registration-time Global Account
path that Phase 0 above identified as missing and deferred.

- **Features**: a Present Location outside the 10 Subcontinent countries now registers correctly
  as a Global Account through the real mobile wizard, not just the website.
- **Root finding**: `register/global.tsx` ("Step 2 · Global account") was never the Global-Account
  present-location screen at all — it is, and remains, the worldwide **Birth Location** picker (a
  pre-existing, unrelated naming collision, now documented and partially relabeled — see below).
  `register/public.tsx` ("Step 3 · Present Location," formerly "Public account") is the actual
  present-location screen, and it hardcoded `onlySubcontinent` on its `LocationPicker`, which is
  what actually needed to change.
- **The fix was smaller than the name suggested**: `LocationPicker`'s own `isComplete()`
  (`locations.ts`) already treats a non-Subcontinent country as complete at the country level, and
  `toStruct()` already serializes a country-only path to exactly `{continent, country}` — both
  already proven correct by the existing birth-location flow, which has never been restricted.
  Removing the one `onlySubcontinent` prop on the present-location screen was the entire
  functional change; no new picker, no new component, no new backend field.
- **Backend contract, verified live** (not assumed): `POST /api/auth/register` with
  `present_location: {continent: {...}, country: {...}}` (no lower-level keys, present or null) →
  `201` with a token for `client:"app"`; the account's classification is **not** in the
  registration response itself — it's read afterward from `GET /api/me`'s `is_global_account`
  field (added to the app's own `Me` TypeScript type this phase; it already existed in the real
  backend response and was simply untyped on the client before now).
- **Account behavior after registration**: `(tabs)/_layout.tsx` now hides the Public tab when
  `me.is_global_account` is true (mirroring `templates/dashboard.html`'s own
  `{% if not profile.is_global_account %}` on the website) — this was a genuine, confirmed gap:
  the app previously showed all 4 tabs unconditionally for every account type. Q-Punch election
  data was already unreachable for a Global Account regardless (`/api/qpunch/village` only
  populates `election` for the one pilot village, which a Global Account's chain can never match)
  — hiding the tab removes the discovery path; the backend remains the actual enforcement layer.
- **UI copy**: the registration wizard's button labels and the review screen's row labels used to
  say "Next · Global account" / "Next · Public account" and "Global account · born in" /
  "Public account · living in" — all now say "Birth Location" / "Present Location" instead, since
  the account-type words were actively misleading (a registrant going through the worldwide
  birth-location step is not thereby registering a "Global Account," and a registrant whose
  present-location *is* Global was shown "Public account" language that doesn't apply to them).
  `register/global.tsx`'s own screen title ("Where were you born?") was already clear and
  untouched; only its header comment and the cross-screen button label changed.
- **Clearing/requiring lower-level state on country change**: already correct, by construction,
  before this phase — `LocationPicker`'s breadcrumb `onChange` truncates the path to the clicked
  tier, and the `useEffect` that re-derives `options`/`done` from the new, shorter path naturally
  re-enters "must keep drilling down" mode for a Subcontinent country or "already complete" mode
  for a Global one. Verified by two new unit tests (see Tests below), not newly built.
- **Tests**: 2 new `vitest` unit tests in `locations.test.ts` (present-location country-only
  completeness + no-fabricated-fields; switching back to a Subcontinent country is incomplete
  until the full chain is picked again); 3 new checks in
  `tools/website-check/check_app_api.py` proving the app's *exact* payload shape registers a real
  Global Account end-to-end against a live copy of the real database and that `/api/me` reports
  `is_global_account: true` with no fabricated fields in `present_location_struct`.
- **Known, unrelated, pre-existing test failure found during this work, not fixed**:
  `locations.test.ts`'s own India walk-through test asserts stale district/tehsil ids
  (`CS.DL.5`/`CS.DL.5.4`) that no longer match the website's real, current data
  (`CS.DL.3`/`CS.DL.3.4`) — present before this phase, unrelated to the Global Account path,
  left untouched per this phase's own scope boundary (same treatment as the separately-tracked
  Board checker failure).
- **Definition of done**: ✅ met — a Global registration through the app's real wizard, using its
  real `LocationPicker`/`toStruct()` output, produces a `201` and a server-confirmed
  `is_global_account: true`, with the Public tab correctly absent afterward.

### Phase 2b: unblock present-location editing in the app
- **Features**: profile-change-request present-location editing, any future present-location
  picker reuse in Settings.
- **Backend contract**: `POST /api/dashboard/edit-request` (now safe post-Phase-1).
- **Mobile work**: finish wiring `profile-change.tsx`'s present-location path if not already
  complete; no new screens needed.
- **Dependencies**: Phase 1.
- **Security**: re-run the ancestry-validation adversarial tests (the omitted-district case
  specifically) before sign-off.
- **Automated tests**: extend `check_app_api.py` or `test_global_account.py` with the
  district-omission case.
- **Manual verification**: attempt the exact exploit payload from §6 through the app; confirm 400.
- **Definition of done**: the exploit payload is rejected end-to-end through the app's own UI path.

### Phase 3 (2026-11-08, completed): Q-Punch election results and winner display in the mobile app

This is about **displaying** existing, backend-authoritative election state correctly — not a
Q-Punch redesign. No backend file was touched; `election_core.py`'s Phase 1 winner-tally fix
remains exactly as shipped.

- **Backend contract, verified live** (fixtures captured from real `election_core.election_summary()`
  calls against a disposable database copy, not invented): `GET /api/qpunch/village` returns
  `{..., election: ElectionSummary | null, guide: ElectionGuide | null}` — `election`/`guide` are
  only populated for the one pilot village (`PILOT_VILLAGE_ID`); every other level/group gets
  `null` for both, by design, not an error. `ElectionSummary.status` is
  `'nomination' | 'voting' | 'closed'`. `candidates[gender][i].votes` is `null` until `status ===
  'closed'` — the backend itself withholds vote counts while voting is open, not a client-side
  choice. `winners` is `null` until `status === 'closed'`; once set, `winners.male`/`.female` are
  **winner NAMES** (strings), never user ids — `election_summary()`'s own `names.get(...)` call
  resolves the id server-side. **There is no backend-declared "tie" field anywhere in this
  response** — a numeric tie (two candidates with equal `votes`) is resolved entirely inside
  `_ensure_tallied()`'s own `ORDER BY votes DESC, MIN(id) ASC` (unchanged, protected) before the
  response is ever built; the app was not given, and does not need, a separate tie signal — the
  per-candidate vote counts already make an equal-votes situation visible to a viewer once closed.
- **Finding: the existing mobile code was already almost entirely correct.** `ElectionCard.tsx`
  and `QPunchSheet.tsx` predate this phase and already: sourced the cycle/sign/timeline/candidates
  from the backend response untouched; hid vote counts via `c.votes !== null`; gated the "Vote"
  button on `guide.can_vote`/`guide.voted_genders` (never recomputing eligibility); displayed
  `winners.male`/`.female` as the literal winner name (correctly, never treating it as an id);
  and refreshed via the existing `onChanged()` → `load()` callback after a successful vote. This
  was true even while the backend's Phase-1 bug was still live — the app was always correctly
  displaying the backend's (at the time, wrong) answer; fixing the backend was what actually
  mattered, not the app's rendering logic.
- **One genuine gap found and fixed**: a CLOSED cycle with zero votes (`winners.male === null &&
  winners.female === null`, confirmed as a real, captured backend response shape) rendered an
  almost-empty "New {sign} leaders" card (just a term-of-work line, no actual message). Now shows
  "No votes were cast this cycle — no leader was elected," and a per-gender "No {gender} leader
  this cycle (no candidate stood)" fallback for the case where only one gender had candidates.
- **Testability refactor (no behavior change)**: the three decision functions
  (`hasAnyWinner`/`isClosedWithNoVotes`/`candidateVoteLabel`) were extracted from `ElectionCard.tsx`
  into a new, plain-TypeScript `electionCard.logic.ts` with zero React/React Native/Expo imports —
  necessary because importing the `.tsx` file directly (to unit-test its logic) pulled in
  `@expo/vector-icons`/React Native, which fails to resolve under plain vitest (no RN component
  test environment is installed in this project). This is the actual, real limitation: these tests
  verify the pure decision logic the JSX calls, not the rendered component tree itself.
- **Account authorization**: re-confirmed live (not assumed) that a Global Account cannot reach
  Q-Punch through the real backend routes regardless of app-side navigation —
  `GET /api/qpunch/village` → 404, `POST /api/election/nominate` → 400, `POST /api/election/vote`
  → 400, all for a real Global Account token. The app's Public-tab hiding (Phase 2) is UX, not the
  security boundary; the boundary is, and remains, `board_core.chain_of()`/`group_for()` and
  `election_core.nomination_eligible()`/`voting_eligible()`, none of which were touched.
- **Tests**: 6 new `vitest` unit tests (`electionCard.test.ts`) against 4 real, captured backend
  fixtures (open/voting, closed-with-winner, closed-with-a-genuine-tie, closed-with-zero-votes);
  3 new `check_app_api.py` checks proving a Global Account's direct route access is rejected by
  the backend itself.
- **Known, unrelated, pre-existing test failure, now fixed as part of this phase's own required
  Phase 2 verification**: `locations.test.ts`'s India walk-through test asserted stale
  `CS.DL.5`/`CS.DL.5.4` ids; confirmed against the website's real current data
  (`CS.DL.3`/`CS.DL.3.4` — `CS.DL.5` is a different district, East Delhi) and corrected in the
  fixture only, same assertions, same test intent.
- **Remaining Q-Punch gap, explicitly out of scope for this phase**: `QPunchSheet.tsx`'s
  `data.cycle.lead`/`data.cycle.kind` fields are a *different*, unrelated concept (today's
  zodiac-sign/element label for the volunteer/agent seat system, `app.py`'s `api_qpunch` route) —
  not the Village Council election. This was already documented in `docs/HANDOVER.md`'s own
  "Q-Punch means three different things" note; re-confirmed here, not changed.
- **Definition of done**: ✅ met — the app correctly displays an open election, a closed election
  with a declared winner, a closed election with a resolved tie (as the backend declares it, with
  no fabricated separate "tie" UI), and a closed election with no votes, all sourced from the
  real, unmodified backend contract.

### Phase 3b: Q-Map base map (public, no consent needed)
**Note on numbering**: renamed from "Phase 3" to avoid colliding with the completed Q-Punch
results/winner-display work below, which this conversation's own instructions labeled "Phase 3."
This Q-Map entry is unrelated and still pending.

- **Features**: read-only public pilot map.
- **Backend contract**: `GET /qmap`-equivalent data route (confirm an `/api/qmap/...` JSON
  equivalent exists or needs adding — the website serves this as a rendered Leaflet page today,
  not necessarily as a clean JSON API; check before assuming raw reuse).
- **Mobile work**: a new map screen (react-native-maps or a WebView embed, to be decided once the
  JSON-vs-HTML question above is resolved).
- **Dependencies**: none.
- **Security**: none — this layer is intentionally public.
- **Definition of done**: the same OSM pilot-area data renders in the app as on the website.

### Phase 4: GPS consent + personal proximity layer
- **Features**: device GPS capture, the 3-flag consent UI, personal proximity results.
- **Backend contract**: `osm_proximity_core.py`'s existing routes.
- **Mobile work**: `expo-location` integration, a consent-version-aware UI, secure handling of
  coordinates (never logged, never cached outside secure storage).
- **Dependencies**: Phase 3b (shares the map screen).
- **Security**: this is the single most privacy-sensitive feature in this entire plan — the
  consent UI's wording and versioning must be reviewed against the backend's actual
  `consent_version` semantics before shipping, not improvised.
- **Definition of done**: a user can grant/revoke each of the three consent flags independently in
  the app, matching the backend's own re-confirmation-on-wording-change rule.

### Phase 5+: lower-priority / product-decision-gated items
- Qmail (needs the whitelist-markup renderer ported faithfully — security-relevant, not a quick
  win).
- Push notifications (new backend capability, not required for parity).
- Referrer redemption UI (blocked on a product decision, not a technical one).

---

## 10. Testing and acceptance criteria

- Every phase above must leave `tools/website-check/check_app_api.py` passing at 100% (it is the
  authoritative cross-repo contract test; it already exercises most of what the app depends on end
  to end).
- Any backend change (Phase 1) must leave `Qumanity_DPG`'s own full suite (`tests/*.py`) at 0
  failures, and specifically must not reduce `tests/test_global_account.py`'s check count.
- New mobile features that touch Present Location, consent, or account classification need a
  dedicated adversarial check (not just a happy-path test) before being considered done, matching
  the standard the website side already holds itself to.
- Manual Android + iOS verification (via EAS build, since this is a managed Expo workflow with no
  checked-in native projects) is required for any feature touching device permissions (GPS,
  camera, notifications) — simulator/emulator testing alone is not sufficient for permission-prompt
  behavior.

## 11. Known blockers

1. **Backend**: `_validate_present_location_change()` district-omission ancestry gap — blocks all
   further present-location mobile work. Unresolved as of 2026-11-08.
   *Status 2026-11-09: resolved in website `a7d43a7` (now
   `account_core.validate_present_location_change()`); re-verified by the checker.*
2. **Backend**: `election_summary()` winner-tally computation — blocks a trustworthy "winners" view
   on mobile. Unresolved as of 2026-11-08.
   *Status 2026-11-09: resolved in website `a7d43a7` (`_ensure_tallied`); re-verified by the
   checker.*
3. **Product decision needed**: the donation-marker field (cosmetic) and referrer-code redemption
   (functional gap) both need an owner decision, not just an engineering fix.
   *Status 2026-11-09: the donation marker is closed (no `donation` object is sent; the checker's
   expectation was corrected). Referrer-code redemption is still open.*
4. **Website-side governance**: the Global Account feature itself is uncommitted; mobile work
   building on it should track that commit, not assume it's permanent.
   *Status 2026-11-09: committed and pushed in website `a7d43a7` (backend) and `a157d7a` (UI).*
5. **Unbuilt from scratch**: GPS/location consent (entire feature), push notifications, Qmail.
6. **Backend security (found 2026-11-09, unresolved, website fix not authorized yet)**: an app
   token issued before an account is retired (`users.is_removed = 1`) keeps working for up to 30
   days. Details and the proposed fix: `docs/phone_app_api.md` → "Known backend gap".

## 12. Tracking checklist

- [x] Phase 0 — Global Account registration payload reconciled (found: no mobile path existed at
      all for this; deferred to Phase 2, now complete)
- [x] Phase 1 — `_validate_present_location_change()` district fix shipped + tested
- [x] Phase 1 — `election_summary()` winner-tally fix shipped + tested
- [x] Phase 1 — donation-marker discrepancy resolved (checker assertion corrected)
- [x] Phase 1 — registration's own Village validation gap closed (corrective follow-up)
- [x] Phase 2 (2026-11-08) — Global Account registration implemented in the mobile app, tested
      end-to-end against a live copy of the real database
- [ ] Phase 2b — present-location *editing* (post-registration) unblocked in the app, adversarial
      test added
- [x] Phase 3 (2026-11-08) — Q-Punch election results/winner display corrected (zero-vote case),
      verified against real backend fixtures; Global Account Q-Punch denial re-confirmed live
- [ ] Phase 3b — Q-Map public base layer in the app
- [ ] Phase 4 — GPS consent + personal proximity layer in the app
- [ ] Phase 5 — Qmail (if prioritized)
- [ ] Phase 5 — Push notifications (if prioritized)
- [ ] Phase 5 — Referrer redemption (pending product decision)
- [x] `docs/phone_app_api.md` check-count reconciled (2026-11-09: 166 checks, 0 failing, local copy)
- [x] 2026-11-09 sync audit against website `af01272` — PIN format, Global Account ID picker,
      notification totals fixed in the app (see §13)
- [ ] Website fix: retired accounts' app tokens rejected in `_app_token_auth()` (needs authorization)
- [ ] `shared/src/ids.ts` / `shared/src/elections.ts` marked deprecated-for-mobile-use or removed

## 13. 2026-11-09 sync audit (website `af01272`, app `aad8a24` + Phase 0–3 working tree)

Evidence-based re-check of every app-facing contract against the website's current `main`, run on
disposable database copies (production / Railway **not** checked). Full contract notes are in
`docs/phone_app_api.md` → "2026-11-09 sync".

- **Re-verified old discrepancies**: (1) registration returns 201 + token and no `donation` object —
  the checker's corrected assertion stands, no backend defect; (2) the election winner tally is
  fixed (`_ensure_tallied`, `a7d43a7`) — names and totals correct, week-4 checker check passes.
- **App changes made**:
  - PIN entry accepts the website's full 5-character rule (letters, digits, symbols,
    case-sensitive); before this a member with a non-numeric PIN could not sign in on the phone.
    `components/pin.logic.ts` + 5 tests.
  - Account ID requests: a Global member is offered countries *outside* the Sub-continent (the old
    Sub-continent-only list produced requests the server's boundary lock always refuses).
    `locations.excludeSubcontinent()` + `LocationPicker outsideSubcontinent` + 2 tests.
  - Notifications: `unread_queries` / `unread_council` (already counted in `total`) shown as rows
    linking to Qmail on the website.
  - Types: `NotificationSummary` gains the two counts; `QoinsConfig.max_donation` optional (no
    longer sent).
- **Checker**: board expectations updated for the own-post vote ban (`8bb34bb`); new checks for
  neighbour voting/vote replacement, letter+symbol PINs, the Global↔Public boundary lock and the
  notification total. 156 pass / 1 fail before → **166 pass / 0 fail** after.
- **Not built in the app (unchanged)**: Q-Map, GPS consent/observations, provisional locations,
  Qmail, Family Tree person editing, `tob_unknown`/`religion_belief`, Phase 2b.
- **Backend gap found (website, not fixed)**: an app token issued before an account is retired
  keeps working for up to 30 days — `_app_token_auth()` does not check `users.is_removed`.
