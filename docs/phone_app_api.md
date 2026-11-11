# Phone app ↔ website API

*Added 2026-09-28. Identical copies live in `Qumanity_App/docs/` and `Qumanity_DPG/docs/`.*

The website (`Qumanity_DPG`, Flask) is the **single backend** for the website and the phone app. Both platforms therefore share:
- accounts (9-digit Private ID + 5-digit PIN), 12-digit search codes and wallets
- the Collective Board, Q-Punch council, village sub-groups and personal groups
- private chats
- the 0_Earth folder writes

The app is a client of the same `/api/...` routes the website's pages use. There is no separate app backend and no copy of the data.

## Sign-in for the app
| Step | Call | Notes |
|---|---|---|
| Sign in | `POST /login` `{private_id, pin, client: "app"}` | returns `{token}` in addition to the website's normal reply; 5 wrong PINs lock the ID for 15 minutes |
| Register | `POST /api/auth/register` `{…, client: "app"}` | same body as the website wizard; returns `{private_code, token}` |
| Every call | header `Authorization: Bearer <token>` | valid for 30 days; the website then treats the request exactly like a signed-in browser session |
| Change PIN | `POST /api/user/pin` `{current_pin, new_pin, client: "app"}` | old tokens stop working; a fresh token is returned |

**How the tokens are built:**
- Tokens are signed with the website's secret key (`QM_SECRET_KEY`).
- They carry a fingerprint of the PIN hash, so changing the PIN cancels them.
- A bad or expired token gets `401 {"error": "Please sign in again"}`.
- Browser logins are unchanged: the website only returns a token when the request says `client: "app"`.

## Added to the website for the app
- `GET /api/me`: the dashboard's Private-profile data as JSON. The readable IDs and the 9-digit code are left out; the code is revealed only through `POST /api/user/private-code` with the PIN.
- `POST /api/user/pin`: change PIN. The website had no change-PIN route yet, only "forgot PIN".
- `QM_HOST=0.0.0.0` makes the site reachable from phones on the same Wi-Fi. The debugger is then off unless `QM_DEBUG=1`.
- **Fix:** registration now creates the new account's 12-digit search code at once. Before this, it only appeared after a server restart (start-up backfill), so new users could not be found.

## App tour and the one-time rating (added 2026-09-29, `review_core.py`)
- `GET /api/onboarding` returns `{tour: null|"done"|"skipped", review_done}`.
- `POST /api/onboarding/tour` takes `{status: "done"|"skipped"}`.
- `POST /api/reviews` takes `{rating: 1–5, text: ≤100 characters, allow_public}`.
  - It works **once per member**: a second attempt returns 409.
  - `{decline: true}` ("No thanks") also uses that chance.
- `GET /api/reviews/public` needs no sign-in. It returns the average over all ratings and the reviews that are **both** allowed public by the member **and** approved by an admin, showing first name and village only.
- `GET /api/admin/reviews` and `POST /api/admin/reviews/<id>/approve` `{approved}` are for admins only.

The app shows the tour once after the first sign-in (skippable, and it can be replayed from Settings). Then comes the rating, whether the tour was finished or skipped.

## Registering someone else, Account IDs, election labels (2026-09-29)
- **Register a new member:** `POST /api/auth/register` with `assisted: true`.
  - On the website, the signed-in member is the helper and stays signed in as themself.
  - In the app, the helper has signed out and sends `helper_private_id` + `helper_pin`. These are checked **before** the account is created, with the same 5-tries lock as sign-in; a wrong PIN returns 403.
  - The helper is the referrer and is stored in `users.referred_by_user_id`. (Originally a cash donation was split between the 8 location wallets, the helper and the new member; that payment path was removed on 2026-10-11 — see "No payments" below. A free registration Qoin is now minted server-side, and the registration response has no `donation` object.)
  - Nobody is signed in afterwards: the reply carries `assisted: true` and no token.
- **Account IDs:**
  - `GET /api/people/me` returns `account_history` (with row `id`) and `account_requests`.
  - `POST /api/people/account-ids/switch` takes `{row_id}`. The member's Public and Global pages follow the active one.
  - `POST /api/people/account-ids/request` takes `{present_location}`, one pending request at a time.
  - The council approves with `/api/admin/account-ids…`. Automatic approval through a local shop's payment is not built; it needs a shop/payments module.
- **Election history:** "Lok Sabha" is now **National Election** and "Vidhan Sabha" is **State Election**.
  - `/api/election-sentiment/country|state/<id>` percentages appear on Country and State pages only.
  - Party lists were updated to each country's latest election (see `election_core.PARTIES_BY_COUNTRY`).

## Routes the app uses
- **Locations:** `/api/world-data`, `/api/subcontinent`, `/api/subcontinent/districts`, `/api/india-villages/<tehsil or district id>`
- **Registration helpers:** `/api/zodiac/preview`
- **Board:** `/api/board/<level>`, `/api/board/post`, `/api/board/vote`, `/api/board/comment`, `/api/board/removed`
- **Council and sub-groups:** `/api/qpunch/<level>`, `/api/qpunch/volunteer`, `/api/subgroups…`, `/api/chat/<id>`
- **People:**
  - search and profile: `/api/people/search`, `/api/people/me`
  - groups: `/api/people/groups…`
  - requests: `/api/people/invite`, `/api/people/message`, `/api/people/inbox…`
  - private chats: `/api/people/chats…`
- **Wallet:** `/api/wallet/balance[/<tier>/<id>]` (Earth's id is `EARTH`), `/api/wallet/history`, `/api/wallet/donate` (simulated), `/api/qoins/config`, `/api/qoins/preview`
- **Account:** `/api/election-history`, `/api/user/languages`, `/api/user/private-code`, `/api/auth/forgot-pin/*`, `/api/auth/recover-id`
- **Statistics:** `/api/location/stats/<level>/<id>`, `/api/earth/stats`
- **Connection check:** `/api/zodiac/current`

## Checking it
`python3 Qumanity_App/tools/website-check/check_app_api.py` runs 166 checks (as of 2026-11-09; 87 when this section was first written). It registers two people, then goes through:
- sign-in, posting and voting, all 8 boards and councils
- search by 12-digit code, a message request that is accepted, private and family chats
- wallet, election history, languages, and a PIN change
- bad and missing tokens, and that the website dashboard still works

It works on a **temporary copy** of the database and a temporary 0_Earth folder, so it can be run at any time.

## Monthly sign election (pilot: Rohini Sector 24, `CS.DL.3.4.1A`) — added 2026-09-29

Every month belongs to one sun sign. The election for that sign runs in 4 weeks:

| Week | Dates (Libra 2026) | What happens |
|---|---|---|
| 1 · Candidates come forward | 23–30 Sep (8 days from the sign's start) | Same-sign men and women aged 25–60 living here stand; at most **3 per gender** (chosen at random when more stand) |
| 2–3 · Voting | 1–14 Oct (14 days) | Every same-sign resident aged 5+ votes once — men for a male candidate, women for a female candidate |
| 4 · Results | 15–22 Oct | Most votes wins (tie → earliest nomination). Winners serve **1 year** (15 Oct 2026 – 14 Oct 2027) |

- `GET /api/qpunch/village` → adds `election` (sign, element, status, `week`, `weeks[4]`, `candidates{male,female}`, `turnout`, `eligible_voters`, `winners` + term) and `guide` (`my_sign`, `my_gender`, `role`, `text`, `action` = `stand`/`vote`/null, `can_stand`, `can_vote`, `voted_genders`). Only on the pilot village.
- `GET /api/election/status` → also `guide`, `weeks`, `week`. `GET /api/election/summary` → the `election` object.
- `GET /api/notifications/summary` → `election` = `{sign, week, action, text}` when the member has something to do (counted in `total`).
- `POST /api/election/nominate` `{reason, why_vote, changes, past_work?}` · `POST /api/election/vote` `{candidate_user_id, gender}`.
- Admin automation: `POST /api/admin/election/auto-nominate` (week 1), `POST /api/admin/election/auto-vote` `{turnout?}` (weeks 2–3).

## Dashboard parity calls — added 2026-09-29
`GET /api/timebox`, `GET /api/lunar/phase`, `GET /api/karma/me` (app: Private → Time-box & Kundali) ·
`GET|POST /api/perception/{country|zone}/<id>[/vote]` (Country and Zone pages) ·
`GET /api/referrer/me`, `POST /api/referrer/apply {note}` (Q-Punch) ·
`POST /api/dashboard/edit-request {name?, email?, phone?, dob?, tob?, reason}` (Private → Change my profile).

## Website changes of Oct 2026 that the app follows (synced 2026-10-06)

- **Server:** release builds talk to `https://qumanity.in` (Railway); `expo start` builds still default to the Mac on the same Wi-Fi. The sign-in screen can override either.
- **No payments (removed 2026-10):** `/api/payment/order`, `/api/payment/verify` and `/api/registration/donation-preview` are gone, along with the app's Razorpay WebView. Qoins are earned through civic activity, never purchased (see `docs/qoins_earn_reference.md`).
- **Registration:** no referral code or volunteer PIN any more. The only referrer is the member doing an assisted registration.
  - Registration is always free; there is no fee or payment step.
- **Hidden results:** `/api/election-sentiment/...` returns `{visible:false, reason}` until 2028 (or until the Founder opens it). Perception GETs return `pro_count/anti_count: null`, `results_visible:false` and `results_reason`. Voting still works.
- **New endpoints the app uses:**
  - `GET /api/me/kundali`: Moon-based Vedic chart SVG, planet table, house strength, elements and dasha. **New website route, added 2026-10-06.**
  - `GET /api/karma/collective/<level>/<id>`;
  - `GET /api/scoreboard/india`;
  - `GET /api/founder-message?lang=`;
  - `POST /api/user/languages {preferred: code}`;
  - `/api/me` adds `birth_location_struct` and `preferred_language`.

## 2026-10-26 sync: profile pictures, middle names, referral by Public ID, Family Tree

### Profile pictures
- **Upload:** `POST /api/profile/picture`, multipart/form-data, field **`picture`**.
  - png/jpg/jpeg/webp only, max **3 MB**; the extension and the declared type must agree.
  - It takes effect immediately; no council approval.
  - The website re-encodes every upload to a 256×256 JPEG and strips EXIF data, including GPS location.
  - App: `Q.uploadProfilePicture({uri, name, type})` uses `client.upload()`. It doesn't set a JSON Content-Type, so fetch adds the multipart boundary.
- **Serve:** `GET /api/users/<id>/profile-picture`.
  - The website decides **per viewer**: for a member with `hide_identity`, only their family gets the picture; everyone else gets a 404.
  - So the app always sends the sign-in token (`authHeaders()`) on image requests, and `<Avatar>` falls back to initials on a 404.
- **Where the URLs come from:**
  - `/api/me` → `profile_picture_url` (added 2026-10-26, website `ca3a10f`), plus `profile_picture_updated_at`, used to refresh the cached image after an upload;
  - board posts → `author_profile_picture_url`; comments, chat messages and member rows → `profile_picture_url`;
  - private chats → `with_profile_picture_url`; people search → `profile_picture_url`.
  - Inbox rows carry only `from_user_id`; the app builds the URL with `Q.pictureUrlFor(id)`.

### Middle name
- `POST /api/auth/register` accepts an optional `middle_name`, and `/api/me` returns it. The website shows `name` unchanged and keeps the middle name as a separate field.
- To change it later: `POST /api/dashboard/edit-request {middle_name, reason}`, approved by the council like the other name fields.

### Referral by Public ID
- `POST /api/auth/register` accepts `referred_by_public_id` (the 12-digit search code). A blank or unknown value is ignored, never an error.
- In an assisted registration the helper always wins, so the app hides the field while "I'm registering someone else" is on.
- The app remembers the signed-in member's Public ID on the phone (`lib/remembered.ts`, key `qm_public_id`) and pre-fills "Referred By" with it. The member can clear it.

### Family Tree (family units)
- `GET /api/family/status` → `{activated, groups:[{id, name, is_admin, is_founder, members}]}`.
  - Activation runs **in the app** (since 2026-10-26): `app/family-activate.tsx` mirrors the website's 6-step wizard (`static/js/family.js`). Until a member has activated, the Family Tree screen offers "Build your Family Tree". Details are in the next section.
- `GET /api/family/node/<unit id>/neighborhood` → `{group_id, name, husband, wife, is_dormant, is_admin, members, unmarried_children[], parent_groups[] (with side), child_groups[]}`.
  - Despite "node" in the path, the id is a family unit. A non-member gets **404** (not 403), and the app shows "Ask to join".
- `GET /api/family-groups/<id>/members` → `{members: MemberRow[]}`, with admins first.
  - Personal group chats (`/api/people/groups/<id>/messages`) return the same `members` row shape.
- **Invite:** `POST /api/family-groups/<id>/invite {user_id}`. It takes a **resolved user_id, never a Public ID**: first `GET /api/people/search?q=<12 digits>`, show the person, then invite. Admins only.
  - The invite arrives in `/api/people/inbox` as `kind: "family_group_invite"`, with `family_group_name`; accepting adds the invited person.
- `POST /api/family-groups/<id>/join-request` (the inbox kind is `family_group_join`) and `POST /api/family-groups/<id>/leave`.

Checks for all of the above are in `tools/website-check/check_app_api.py` (138 pass as of 2026-10-26).

### Family Tree activation wizard (in the app, 2026-10-26)
The steps and payloads are the same as the website's `static/js/family.js`.

**Steps**
1. **Parents:** father and mother (required, with "passed away" switches), plus optional grandparents.
2. **Status:** `single | married | separated | divorced | widowed`.
3. **Spouse:** skipped for single. "Already on Qumanity?" looks up a Public ID and sends the spouse as `{action:"notify", user_id}`. Widowed marks a newly created spouse `is_deceased`. The spouse's parents are optional.
4. **Children:** skipped for single. Asks yes/no first, then each child as `{name, gender: male|female|both}` (shown as Son, Daughter, Third gender).
5. **Discover:** `GET /api/family/suggest?name=` for each of father, mother, spouse (unless already linked) and each child. Only `type: group` (→ `{action:"join", group_id, matched_node_id}`) and `type: unactivated_user` (→ `{action:"notify", user_id}`) are offered; the default is `{action:"create"}`. Grandparents and the spouse's parents are always created.
6. **Review:** `POST /api/family/activate {father, mother, relationship, father_father?, father_mother?, mother_father?, mother_mother?}`.
   - Then, unless single: `POST /api/family/marry {spouse, children[], marriage_status, spouse_father?, spouse_mother?}`.
   - `marriage_status`: married → `active`, separated → `separated`, divorced → `dissolved`, widowed → `active`.
   - Activation can only happen once (a second call returns 400).
   - If `marry` fails, the member stays activated and the app offers "Try adding your spouse again".

## 2026-11-09 sync: website release `af01272` (Global Accounts, C1 validation, election tally)

Audited against the website's `main` at `af01272` (application commits `a7d43a7` backend, `a157d7a`
website UI; `af01272` is documentation only). Checked against the running code on a throwaway
database copy, not taken from documents. `tools/website-check/check_app_api.py`: **166 passed, 0
failed** after this sync.

### Global Account (server-decided)
- A member whose Present Location's country is outside the 10 Public Account countries is a
  **Global Account**. The server decides this from `present_location_json` every time; the app
  never sends a flag, and none would be trusted.
- **Registration**: `present_location` stops at `{continent, country}` (no state/zone/district/
  tehsil/village keys — sending any is a 400). The app's `register/public.tsx` picker produces
  exactly that for a non-Sub-continent country (Phase 2).
- **`GET /api/me`** → `is_global_account: boolean`. The app uses it for UI only (hiding the Public
  tab, choosing which countries the Account ID request offers). Every permission is still checked by
  the server.
- **Boards for a Global Account**: Country, Continent and Earth boards are readable; `can_post` and
  `can_pay_post` are false on all three (those three levels are broadcast-and-vote only for every
  member; a post there is refused: "Posts cannot be made on this page"); Zone/State/District/
  Tehsil/Village boards return 404 for a Global Account. The app's composer appears only
  when `can_post || can_pay_post`, so it follows this without special cases.
- **Q-Punch**: a Global Account is never eligible (`/api/qpunch/village` 404, nominate/vote 400).

### Account ID requests (C1 correction, 2026-11-08)
- `POST /api/people/account-ids/request` and the admin decision both run
  `account_core.validate_present_location_change()`: full ancestry checks, real-village existence,
  and a **hard Global↔Public boundary lock** in both directions (400: "Moving your Present Location
  across the Public/Global Account boundary isn't supported through this request -- contact Admin.").
- **App change (2026-11-09)**: the request screen used to offer only the 10 Sub-continent
  countries to everyone, so a Global member could only send requests that are always refused.
  `account-ids.tsx` now offers a Public member the 10 Sub-continent countries (as before) and a
  Global member every *other* country (`LocationPicker outsideSubcontinent`,
  `locations.excludeSubcontinent()`). The website's own copy of this document says "no app change
  was needed" here; that is correct for Public members only.

### PIN format (website `PIN_RE`)
- A PIN is **5 characters**: letters, digits or the symbols `!@#$%^&*()_+-=[]{}|;:'",.<>/?`, at
  least one letter or digit, **case-sensitive**. Checked on sign-in, registration, PIN change and PIN
  reset; refused PINs get `"PIN must be 5 characters. It can include numbers, letters, or special
  characters — but not all special characters."`
- **App change (2026-11-09)**: `CodeInput` accepted digits only, so a member with a letter/symbol
  PIN could not sign in on the phone. PIN boxes now use the full keyboard and the same character
  set (`components/pin.logic.ts`); one-time codes stay digits only.

### Collective Board: own posts
- Since website `8bb34bb`: **nobody votes on their own post**. The author gets `can_vote: false`
  and a vote is refused. The app shows vote buttons only when `can_vote` is true — already
  aligned. Vote replacement (sending `0`, `1` or `-1` again) still works for everyone else.

### Q-Punch election results
- `election_core._ensure_tallied()` now recomputes a closed cycle's winners from the current votes
  (`a7d43a7`). Verified: `winners.male`/`.female` are the persisted winners' **names**, with
  `male_votes`/`female_votes` totals; `votes`/`winners` are `null` until `status == "closed"`.
  Response fields match the app's `ElectionSummary`/`ElectionGuide` types exactly; the app
  displays them as sent (no client-side winner or tie logic).

### Registration response
- No `donation` object (never sent since payments were removed). The checker's old expectation of
  one was the stale part; nothing in the app reads it.
- New optional fields the app does not send (registration works without them): `tob_unknown`,
  `religion_belief`, and provisional `"PROV-<n>"` village/tehsil ids created through
  `POST /api/locations/provisional`.

### Notifications
- `GET /api/notifications/summary` adds `unread_queries` (Admin's replies to the member's
  questions) and `unread_council` (their Q-Punch council's replies), and **`total` includes both**.
  Both are read in Qmail, which the app does not have. **App change (2026-11-09)**: the
  Notifications screen lists them as rows that open Qmail on the website, so the bell never counts
  items the screen doesn't show.

### Removed / not used by the app
- `GET /api/poems/meta` and `/api/poems/<lang>/<index>` were removed with the website's marquee.
  The app's marquee is off by default (`QM_MARQUEE_ENABLED`), so nothing calls them; its code and
  the skipped `marquee.test.ts` remain until a decision is made about the marquee.
- New website routes **not used by the app** (features the app doesn't have yet): Family Tree
  person editing (`/api/family/person/<id>/{cascade,child,sibling,spouse}`,
  `/api/family/node/<id>/details`), GPS observations (`/api/location/observation`,
  `.../withdraw-overpass`), provisional locations and location search (`/api/locations/provisional`,
  `/api/locations/search`), Q-Map (`/api/qmap/user-nearby/<id>`), `/api/public-ids/suggest`,
  `/api/support/ticket`, `/api/queries/mine`.

### Known backend gap (website fix needed) — UNRESOLVED
- **Issue**: a **retired account** (`users.is_removed = 1`) can no longer sign in (`/login` and
  the registration helper check `_verify_helper()` filter `is_removed = 0`, website `087c48e`), but an app token issued
  before retirement keeps working until it expires (`APP_TOKEN_DAYS = 30`). `_app_token_auth()`
  checks the signature, expiry and PIN fingerprint, not `is_removed`.
- **Evidence (local, disposable DB copy; production not checked)**: after setting
  `is_removed = 1`, the member's existing token got `/api/me` → 200 and a village board post →
  201. The checker prints this every run as an `INFO KNOWN BACKEND GAP` line (not counted as a
  pass or a failure).
- **Proposed website fix (not implemented — needs the owner's authorization)**: in
  `_app_token_auth()`, select `pin_hash, is_removed` and return
  `401 {"error": "Please sign in again"}` when the row is missing, the PIN fingerprint differs,
  **or `is_removed` is set**. Add a website regression test: register → take the app token →
  set `is_removed = 1` → `/api/me`, a board post and another protected `/api/...` route must all
  return 401. When the fix lands, the checker's INFO line turns into a counted check.
- **App side, already in place**: `api/client.ts` calls the handler `state/app.tsx` registers (sign out)
  on any 401 to a signed-in request — covered by `client.test.ts` "a 401 signs out" — so no app
  change is needed for the fix.
- Related, not tested: website browser sessions (`login_required`) only check that
  `session["user_id"]` is set, so an already-open browser session of a retired member may have
  the same gap. Website-only; noted for the website fix.

## 2026-11-12 sync: website `99106ce` (production qumanity.in)

Checked against the website's `main` at `99106ce` (production was closed at `0d1b87f` on 2026-11-11;
`99106ce` adds the Admin Panel LBE). Backend changes since the 2026-11-09 sync, from the code:

- **Retired accounts** (`e045cf1`): an app token for a retired account (`users.is_removed = 1`) now
  gets `401 {"error": "Please sign in again"}`; browser sessions are redirected to `/login`. The app
  signs out on any 401 and lands on the Welcome screen (Sign in button) — no app change needed. The
  checker's old "known gap" INFO line is now a counted check.
- **Email** (`147f833`, `3a6ecd3`): Resend → SendGrid, website only (admin notifications). No app change.
- **LBE** (`99106ce`): `/api/admin/lbe/resolve` and `/api/admin/lbe/log-event` are Admin Panel
  routes. The app has no Admin Panel; **not built in the app** (gap, by design for now).
- **Qoin reward range**: unchanged in the backend (`qoin_core.REWARD_RANGE_INR`, 1–10 Qoins at
  Village up to 1,500–2,000 at Earth, since 2026-10-17); `1decd54` only corrected the About page
  text. The app does not display reward ranges.
- New pages `/privacy` and `/terms` (website only).

### Registration: now sent by the app
- **`religion_belief`** (optional, private): one of `hindu, christian, muslim, sikh, buddhist, jain,
  other, prefer_not_to_say` (`RELIGION_BELIEF_VALUES`); anything else is a 400. Not answered = not
  sent (stored NULL, can be answered later). **Any saved value is locked** — including
  "prefer_not_to_say"; changing it needs an Admin request. The app shows single-select chips with
  that hint (`components/registration.logic.ts`).
- **`tob_unknown: true`** ("I don't remember my exact birth time"): the app sends no `tob` at all.
  The server stores 12:00 and `birth_time_known = 0`; the real time can be added later through
  Admin.
- `middle_name` (already sent since 2026-10-20).
- The response has **no `donation` / `donation_error`** (removed from `RegisterResult`).

### Known website bug: provisional locations ("Can't find my Tehsil/Village")
The provisional location endpoint requires sign-in, but registration is anonymous. The website's
own "Can't find" button may fail for a new member who registers alone. This needs a website fix
before the app can use it. (`POST /api/locations/provisional` is `@login_required`, `app.py`;
registration's `PROV-<n>` ids can only come from that route.) Not offered in the app.

### How this is checked
- `tools/website-check/check_app_api.py` loads the website **code** and runs on a **temporary copy of
  the local database** — it creates accounts, posts and votes, so it is never pointed at
  production. 170 checks, 0 failing, against `99106ce` (2026-11-12).
- Production is checked **read-only**: `GET /healthz`, `/api/world-data`, `/api/subcontinent`,
  `/api/subcontinent/districts`, `/api/zodiac/{current,signs,preview}` (all 200), `/api/me` with a
  fake token → 401, with no credentials → 302 `/login`. Nothing is written.
- Release builds (`__DEV__ = false`, e.g. an EAS APK) always use `https://qumanity.in`
  (`api/client.ts` `defaultServer()`); `mobile/.env`'s `EXPO_PUBLIC_API_BASE_URL` only affects
  Expo Go development and is never uploaded to EAS (gitignored).

## Android APK distribution (2026-11-12)

- **Build**: EAS Build (cloud), `mobile/eas.json` profile `preview` → an installable `.apk`
  (`distribution: internal`, `android.buildType: apk`). Command, from `mobile/`:
  `eas build --platform android --profile preview`. No profile sets any `EXPO_PUBLIC_*` value
  (the unused `EXPO_PUBLIC_AUTH_TEST_MODE` flag was removed 2026-11-12).
- **Server**: a release build always talks to `https://qumanity.in` (`defaultServer()` in
  `api/client.ts`); nothing in `mobile/.env` is uploaded to EAS.
- **Signing**: EAS generates and stores the Android keystore on the first build. Every later APK
  must be signed with the same key or phones refuse to update — keep a downloaded backup
  (`eas credentials` → Android → Keystore).
- **Website dependency (not built yet; website task)**: printed QR codes point to
  `https://qumanity.in/app`. The website needs (1) the current APK hosted at a stable URL on
  qumanity.in (e.g. `/app/qumanity.apk`) and (2) a `/app` route that redirects to it. A new APK
  then only needs the file (or the redirect) replaced — the printed QR code never changes. Until
  that route exists, `/app` is not live and the QR code must not be printed.
