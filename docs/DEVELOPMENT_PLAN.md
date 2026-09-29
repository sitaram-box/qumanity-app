# Qumanity Phone App — Development Plan

*Version 2 · 2026-09-26 · Android + iOS · React Native (Expo SDK 57) + Firebase (Blaze)*

Version 2 adds your refined specification:
- post elevate / freeze / remove, and comments
- the 9-digit User ID and 10-digit Account IDs
- corrected chat permissions (Social Workers post at District)
- zodiac-based council elections with minimum user counts
- private chats with friend / family / message requests

Points where I had to interpret the spec are marked **❓** and listed in §16. Development follows my stated assumption until you answer.

> **Current architecture (decided 2026-09-28): the website is the backend.**
> The phone app calls the Qumanity website API (`Desktop/Qumanity_DPG`), so the website and the app share one set of accounts, wallets, boards, chats and 0_Earth folder writes.
> - Testing runs on the same Wi-Fi with Expo Go. See [TESTING_GUIDE.md](TESTING_GUIDE.md) and [phone_app_api.md](phone_app_api.md).
> - Firebase (§17) is **parked**. It comes back for push notifications, SMS and public hosting when needed.
> - Where this plan and the shared spec files disagree, the spec files win: [private_id_and_login.md](private_id_and_login.md), [qpunch_council.md](qpunch_council.md), [personal_timeline_and_social.md](personal_timeline_and_social.md) and the others listed in §19. Examples: the 12-digit search code, 5 personal groups, and council seats Founder / Male Leader / Female Leader / Managers / Agents & Volunteers.

---

## 1. What we are building
Qumanity is a WhatsApp-style **governance and commercial** app. You sign in with your phone number (OTP) and a 5-digit PIN. The app places you in the groups of your *present* location, from Village up to Earth, across the 10 countries of the Indian Sub-continent: India, Nepal, Bhutan, Bangladesh, Myanmar, Sri Lanka, Pakistan, Balochistan, Afghanistan and Maldives.

Each person has **4 timelines**:

| Timeline | Contents |
|---|---|
| **Private** | one-to-one chats, friend/family/message requests, my removed posts, my IDs |
| **Personal** | **Family** group, **Friends** group (max 2) |
| **Public** | **Village, Tehsil, District, State, Zone** groups (local tier names; hidden tiers skipped, e.g. Nepal has no Zone) |
| **Global** | **Country, Continent (Asia), Earth** groups |

Every Public and Global group has a **Chat** tab (messages) and a **Timeline** tab (posts that are voted on and elevated).

---

## 2. Technology stack

| Part | Choice |
|---|---|
| App | Expo SDK 57, React Native 0.86, TypeScript, Expo Router (`mobile/`, installed) |
| Firebase SDK | React Native Firebase v26 (native: offline cache, FCM); needs a **development build**, not Expo Go |
| Auth | Firebase Phone Auth (OTP) + our **5-digit PIN** (server-hashed) |
| Data | Cloud Firestore with `onSnapshot` listeners |
| Server | Cloud Functions 2nd gen (TypeScript): IDs, PIN, tallies, elevation, elections, requests, notifications |
| Files | Firebase Storage |
| Push | Firebase Cloud Messaging (device tokens + per-group topics) |
| Build | EAS Build / Submit → TestFlight, Google Play |
| Shared logic | `shared/` TypeScript package used by the app, functions and tools |

---

## 3. Project folders (`Desktop/Qumanity_App`)
```
Qumanity_App/
├── README.md
├── docs/DEVELOPMENT_PLAN.md       this file
├── mobile/                        Expo app (screens in src/app, code in src/)
├── shared/src/                    ids, zodiac, tiers, groups, posts, elections, schema (+ tests)
├── functions/src/                 Cloud Functions
├── firebase/                      firestore.rules, firestore.indexes.json, storage.rules
├── firebase.json, .firebaserc     Firebase CLI config (project id set when you create it)
└── tools/                         seed (from Desktop/0_Earth), bootstrap (Mentor), earth_sync
```
Location data stays in `Desktop/0_Earth`. The tools read `Qumanity_Master.json` from there and write Firestore. The app never bundles a copy.

---

## 4. IDs (your Part 2)

| ID | Digits | Based on | Lifetime | Who sees it |
|---|---|---|---|---|
| **User ID** (Private ID) | **9** random, e.g. `482 915 307` | **birth** location; recorded in the birth village | birth → death, never changes | only the user (and admins via reveal) |
| **Account ID** (Public ID) | **10** random, e.g. `7310 042 285` | **present** location | a new one each time the user moves; old ones kept as history | everyone: used to search, private chat, friend/family requests |
| **Group ID** | 9 random | a location or a personal group | permanent | members |

**Hidden readable format**
- Each number points to a *readable ID* holding the metadata. The readable ID is kept in **server-only** records (`identities/…`) that the app cannot read.
  - Private: `RM-0042-GM-AY-FL-CS.DL.5.4.1E`, i.e. initials, **serial in birth village**, gender (GM/GF/GO), age (AB Balak 0–24, AY Yuvak 25–49, AV Vridh 50–75, AS Sanyas 76+), zodiac code, **birth** location.
  - Account: `RM-0107-GM-AY-FL-CS.DL.5.9.3`, i.e. the same person codes with the **serial in the present village** and the **present** location.
  - Zodiac codes are element + sign letter, as on the website: FA Aries, ET Taurus, AG Gemini, WC Cancer, FL Leo, EV Virgo, AL Libra, WS Scorpio, FS Sagittarius, EC Capricorn, AA Aquarius, WP Pisces.
- **Only council (admin) members** can convert a User ID or Account ID into its readable form, through the `revealId` function.
  - Allowed only when the caller holds a council seat in a group on the person's birth or present chain. As Mentor you can reveal everyone.
  - Every reveal is written to an audit log.

**Counting members**
- The birth village gets a **born-here serial** for each person but its `user_count` does **not** increase unless the person lives there.
- `user_count` counts **present residents only**. It drives the election thresholds (§8).
- Moving to a new village creates a new Account ID and a new present-village serial. The old village count goes down and the new one goes up.

**Uniqueness:** Cloud Functions mint every number inside a transaction on `id_registry/{number}`. Serials come from `counters/{groupId}`. A number is never reused, across users, accounts and groups.

---

## 5. Sign-up and PIN
1. **Phone:** OTP (Firebase Phone Auth).
2. **PIN:** create a 5-digit PIN.
3. **Profile:** name, gender (Male/Female/Other), DOB, time of birth, mother tongue.
4. **Birth location:** any country. Inside the Sub-continent, down to village.
5. **Present location:** must be in one of the 10 countries.
6. The `register` function:
   - mints the User ID and Account ID and the readable IDs
   - joins the present-location group chain and increments `user_count` up the chain
   - records the birth-village serial
   - sets the login claims
7. The app opens on the 4 timelines.

**PIN handling**
- The PIN is hashed with scrypt and a per-user salt in `secrets/{userId}`, which the app cannot read.
- It is asked after OTP on a new device and to unlock the app. Face ID or fingerprint can also unlock.
- 5 wrong tries lock it for 15 minutes. 10 wrong tries require a new OTP.
- **Registration opens only when the user's whole group chain is active**, i.e. has a council member (§6).

---

## 6. Quantum Punch Council (your Part 3)
Every group from Village to Earth has **5 admin seats**:

| Seat | Role | Filled by | v1 |
|---|---|---|---|
| 1 | **Founder / Admin** (the Mentor; name never shown in the app) | appointed | **you, +91-8287696616**, on every group |
| 2 | **Male Leader** of the current sun sign (village) or element (above) | elected yearly; serves only that sign's month, then is released | empty |
| 3 | **Female Leader**, same | same | empty |
| 4 | **Managers** — a team hired by the council | hired by seats 1–3 | empty |
| 5 | **Agents & Volunteers** — volunteers register themselves (village), agents are hired (all levels) | open registration / hired | empty |

Full description: [qpunch_council.md](qpunch_council.md).

- A group is **active** while at least one seat is filled. With no seats filled it is **disabled** (read-only).
- **Bootstrap order:**
  1. Seed all locations from 0_Earth.
  2. You register first; your number is the configured `OWNER_PHONE`.
  3. `tools/bootstrap` creates ≈718k groups (every location with a tier label, plus Asia and Earth), with you as Mentor. This costs a few dollars of Firestore writes, once.
  4. Registration opens to the public.
- Council members can:
  - post in admin-only groups
  - approve **Social Workers** for their District
  - reveal readable IDs
  - moderate: hide messages, mute members

---

## 7. Who can post (your Part 4, corrected)

| Group | Chat box & new posts | Everyone else (members) |
|---|---|---|
| **Village** | **every present resident**: messages, media, posts, votes | birth-village members: read only |
| **Tehsil** | council only (broadcast) + posts elevated from villages | read, vote on active elevated posts ❓Q1, comment on finished posts |
| **District** | **approved Social Workers** + council | read, vote ❓Q1, comment on finished posts |
| **State, Zone** | council only | read, vote ❓Q1, comment on finished posts |
| **Country, Continent, Earth** | council only | read, vote ❓Q1, comment on finished posts |
| **Family / Friends** | all members | the owner manages members |

**Social Worker** is a badge per District.
- The District council approves it for people with good social performance and behaviour credits, e.g. officials, doctors, engineers and social workers.
- The badge is stored as a server-only field. It shows next to the person's name and can be withdrawn.

---

## 8. Posts: vote → elevate / freeze / remove (your Part 1)

### 8.1 Lifecycle
Each post has a **separate record per level** (`groups/{g}/timeline/{postId}`), linked by `origin_post` and `elevated_to`.
- When a post elevates, its old copy is marked *elevated* and opens for comments.
- A new *active* copy starts voting at the next level.

```
Village (7d) ─► Tehsil (8d) ─► District (9d) ─► State (10d) ─► Zone (11d) ─► Country (12d) ─► Continent (13d) ─► Earth (14d)
```

At the end of each voting window, the `closeVoting` job (runs every 15 minutes) decides:

| Level | Days | **Elevate if score ≥** | 0 < score < threshold | score ≤ 0 |
|---|---|---|---|---|
| Village | 7 | **+10** | **Freeze** | **Remove** |
| Tehsil | 8 | +100 | Freeze | Remove |
| District | 9 | +1,000 | Freeze | Remove |
| State | 10 | +10,000 | Freeze | Remove |
| Zone | 11 | +100,000 | Freeze | Remove |
| Country | 12 | +1,000,000 | Freeze | Remove |
| Continent | 13 | +10,000,000 | Freeze | Remove |
| Earth | 14 | (+100,000,000 = "Earth honour") | **Freeze on Earth** | Remove |

What each outcome means:
- **Freeze:** voting closes, and the post stays readable with its total score and voting dates. **Comments open.**
- **Remove:** the post disappears from the page and is moved to the author's **Private timeline** (`users/{u}/private_posts`).
- **Elevate:** the post moves up a level. A tier the country hides is skipped, e.g. Nepal goes District → Country. The threshold and voting days used are always those of the level the post is on.
- **Comments** exist only on *frozen* or *elevated* posts, never while voting is running. The security rules enforce this.

### 8.2 Votes and scores at scale
- A vote is +1, 0 or −1 in `…/timeline/{p}/votes/{userId}`. Because the document id is the voter's ID, nobody can vote twice. People can change their vote until the deadline, and a vote sent from an offline phone is safe to resend.
- The score is maintained by a function on each vote change, using **sharded counters**. Earth needs up to 100M votes within 14 days, which is about 80 votes a second; a single Firestore document can take only about 1 write a second. The shard count grows with the level: 1 at Village, up to 200 at Earth.
- **Who votes:** present residents of the post's current group. Birth-only members can read but not vote. The rules check the voter's present chain and that `request.time < voting_end`.

---

## 9. Council elections (your Part 5)
Council elections are **separate from post voting** and run once a year.

### 9.1 Village — Lower House, 24 seats (12 signs × Male/Female)
- Elections start only when the village has **≥ 100 present residents**.
- **Each month is one sun sign's turn.** The cycle runs over the sign's dates (e.g. Leo 23 Jul – 22 Aug). It opens with a 7-day nomination period, then voting until the end of the sign period.
- **Voters:** present residents born under that sign. Men vote for male candidates of the sign, women for female candidates. **One vote per person per year**, cast in their own birthday sign's cycle. ❓Q3
- **Candidates:** present residents of that sign and gender. The age rule follows the website (Yuvak 25–49) ❓Q4.
- **Winners:** the top male and top female candidate lead during **their sign's month only** (seats 2 and 3 that month), then are released; they may stand again or stand for the next council up.
- People registered as Other can vote for either seat of their sign ❓Q5.

### 9.2 Tehsil — Upper House, 8 seats (4 elements × Male/Female)
- Elections start when the tehsil has **≥ 1,000 residents**.
- **Electors:** the Lower House members of all villages in the tehsil, e.g. 10 villages × 24 = 240.
- **Candidates:** Lower House members. There is one seat per element per gender: Fire, Earth, Air and Water, each with a man and a woman.
- Electors vote for the seat of their own element and gender, following the village rule ❓Q6.

### 9.3 District → Earth, 8 seats each
- Each level elects 8 seats (element × gender) once a year, from the council of the level below. The electors and candidates are the 8-member councils of all child groups.
- Minimum residents before elections run:

| Level | Village | Tehsil | District | State | Zone | Country | Continent | Earth |
|---|---|---|---|---|---|---|---|---|
| Min users | 100 | 1,000 | 10,000 | 100,000 | 100,000 | 1,000,000 | 1,000,000 | 10,000,000 |

- **Proposed annual calendar:** Village cycles run all year, one sign a month. The upper levels run one after another, one level per month, after the village year completes ❓Q7.
- Data: `elections/{id}` (group, level, sign or element, gender, phase, dates), `…/candidates/{accountId}`, and `…/ballots/{userId}`. Ballots are secret; only tallies are shown. Results go to `groups/{g}/house/{seat}`.

---

## 10. Private chats and requests (your Part 7)
- Private chats live in the **Private timeline**. People are found **by Account ID**, the 10-digit number, and see only the public profile: display name, photo and village name.
- **Request types:**
  - **Friend request**
  - **Family request**
  - **Message request:** one first message, after which the sender waits for approval
- The recipient can **Accept**, **Decline** or put the request on **Waiting**. A pair can have only one open request of each type.
- **Accepting a request:**
  - **Message:** a private chat opens.
  - **Friend / Family:** each person is added to the other's **Friends / Family** group. The group is created automatically if it is missing, still max 2 groups per person ❓Q8. They can also chat privately.
- Data: `requests/{id}` (from_account, to_account, type, first_message, status), `chats/{accA_accB}` + `messages/`, and `users/{u}/contacts/{accountId}` (relation). When someone moves and gets a new Account ID, their chats and contacts are updated to it.

---

## 11. Security rules (research item 3)
- **Claims:** after registration the server sets login claims `{ uid: <UserID>, acc: <AccountID>, chain: {village…earth → groupId}, owner?: true }`, about 200 bytes. Most permission checks need no extra reads.
- **Chat message create:**

  ```
  isActive(g) && isResident(g) && (
    g.mode == 'open'                                   // Village, Family, Friends
    || (g.mode == 'social_workers' && isSocialWorker(g)) // District
    || isCouncil(g))                                   // every level
  ```
- **Post create:**
  - Village: residents.
  - District: Social Workers.
  - Any level: council.
  - Elevated copies are created by the server only.
- **Vote:** resident of `post.group`, `post.status == 'active'`, `request.time < post.voting_end`, value ∈ {−1, 0, 1}, doc id = my User ID.
- **Comment:** member and `post.status in ['frozen','elevated']`.
- **Server-only data:** scores, status, council, badges, counts, IDs, identities, secrets, elections tallies. Clients cannot write these, and they cannot read identities or secrets.
- **Testing:** rules are tested in the Firebase Emulator with `@firebase/rules-unit-testing`. That needs **Java**, which is not installed on this Mac yet.

---

## 12. Offline (research item 4)
- **Firestore cache:** the offline cache is on by default in React Native Firebase. Recent chats, posts and groups stay readable offline.
- **Messages:** each message gets a client-made id and is written at once, showing ⏱. Firestore delivers it when back online and it shows ✓. It can never be duplicated.
- **Media:** files are copied locally and queued, then uploaded on reconnect.
- **Votes:** saved locally and synced later. The deadline is checked on the server, so a late vote is rejected and the app shows "voting had closed".
- **Read receipts:**
  - Groups store one `last_read_at` per member.
  - Private chats store `read_by` on each message.

## 13. Notifications (research item 5)

| Event | How |
|---|---|
| Private and Family/Friends chat message, request received or answered | each recipient's device tokens |
| Village chat | village topic (members can mute it) |
| Admin broadcast (Tehsil → Earth), Social Worker post (District) | group topic |
| **Voting reminder:** "3 posts in your village close tomorrow" | daily job at 9 am local time, village topic |
| **Your post** elevated / frozen / removed | author's devices |
| **Election:** "Leo nominations open", "Your vote is due" | per-village sign topic `v_<group>_<sign>` |

---

## 14. Firestore collections (final)
```
users/{userId}            self-only: phone, name, account_id (current), account_ids[], gender, dob, tob, language,
                          zodiac_type, birth_location, present_location, chain, personal_groups, fcm_tokens
accounts/{accountId}      public profile: display_name, photo_url, village_name, active
identities/{userId}       server-only: readable_private_id, birth serial, metadata
account_identities/{acc}  server-only: readable_account_id, user_id, present serial
secrets/{userId}          server-only: pin hash, salt, tries, lock
id_registry/{number}      server-only
counters/{groupId}        server-only: born_serial, resident_serial
locations/{locationId}    name, level, parent_id, country_id, label, group_id
groups/{groupId}          name, timeline, level|kind, code, parent_group, mode, council_ids[], is_active, user_count, last_message
  council/{seat}          5 seats         house/{seat}    elected houses (24 or 8)
  members/{userId}        personal groups + birth-village readers
  social_workers/{userId} District approvals
  messages/{id}           chat
  timeline/{postId}       author_id, content, media, score, voting_start, voting_end, status, origin_post, elevated_to
    votes/{userId}        score_shards/{n}        comments/{id}
users/{userId}/private_posts/{id}   removed posts
users/{userId}/contacts/{accountId} friend|family
requests/{id}             friend|family|message requests
chats/{accA_accB}         private chats + messages/
elections/{id}            candidates/, ballots/ (secret), results
```
Your draft schema stored `members[]`, `votes{}` and `comments[]` inside group and post documents. At Earth scale those would exceed Firestore's 1 MB document limit and its write rate. Here they are sub-collections, and counts are kept on the parent documents.

---

## 15. Phases

| # | Phase | Plan | Deliverables |
|---|---|---|---|
| **0** | **Structure** ✅ | Spark | folders, docs, `shared/` + tests, Firebase config, security rules |
| **1** | **Phone auth + registration** ✅ built | Spark | OTP (test numbers), PIN, profile, birth/present pickers, client-side registration transaction validated by rules (§17) |
| **2** | **Seed + Mentor** ← *next* | Spark | `tools/ops seed` (Delhi pilot), rules deploy, first Android test build, App Distribution |
| 3 | Chat | Spark | group chat with permissions (text), Social Worker approvals, private chats, requests, Family/Friends |
| 4 | Posts | Spark | posts, votes (score updated with the vote, checked by rules), `tools/ops close-voting` for elevate/freeze/remove, comments |
| 5 | Elections | Spark | village sign cycles, upper houses, thresholds (tally with `tools/ops`) |
| 6 | Blaze switch | **Blaze** | deploy `functions/` (register, PIN, closeVoting schedule), Storage for media, FCM push, real SMS |
| 7 | Media + notifications | Blaze | images, documents, voice notes; push reminders |
| 8 | Hardening + release | Blaze | rules test suite, moderation, iOS app (TestFlight), Google Play ($25) |

**Your to-dos now:** see §17.4.

---

## 16. Decisions and open points

**Confirmed by the founder (2026-09-27)** — these replace the earlier assumptions:
0. **Eligibility:** voters are anyone aged 5+ (Balak from 5, Yuvak, Vridh; male, female, third gender); candidates are Yuvak or Vridh up to 60, Village → Earth. Voters pick candidates of their own sign/element and gender. A leader **serves only their sign's month** and is then released (no 11-month term); they may stand again or stand for the next council up.
1. **Post voting above Village:** every *present resident* of the post's group votes on posts there; birth-village-only members read only. Post outcomes are exactly §8 (elevate / freeze / remove); a positive score alone never elevates.
2. **Council seats:** every group Village → Earth has **5 seats**; seat 1 is the **Mentor (the founder, admin account)**. Seats 2–4 are elected, seat 5 is hired by seats 1–3.
3. **Village elections:** one vote per person per year, on their birthday's sun-sign cycle; men vote for male candidates and women for female candidates of that sign → **24 members a year** (12 signs × 2). Only people *living* in the village vote.
4. **Upper houses:** the 24 elect the Tehsil upper house of **8** (4 elements × M/F); every level above elects 8 from the council members of the level below. Minimum residents: 100 / 1,000 / 10,000 / 100,000 / 100,000 / 1,000,000 / 1,000,000 / 10,000,000 (Village → Earth).
5. **Chat permissions:** District is *not* open to everyone. Only admins, approved Social Workers (good social performance and behaviour credits, approved by the council) and elevated posts appear there. Frozen posts show voting time, total score and comments.
6. **Private chats** live in the Private timeline. Anyone can be found by their public **Account ID** (10 random digits) and receive a friend request, family request or a single first message that waits for Accept / Decline / Waiting.
7. **Readable IDs** stay hidden behind the 9-digit User ID and 10-digit Account ID; only group admins can reveal them.
8. **Users can also rate and comment after voting closes or a post freezes,** never while voting is open.
9. A user's **User ID is fixed for life** (private account, birth village); a new **Account ID** is created for every present location, so one person can have many Account IDs.

**Still open** (assumption used until answered)
- ❓ **Gender "Other" in elections:** may vote for either seat of their sign, cannot stand.
- ❓ **Annual calendar for Tehsil → Earth elections:** one level per month after the village year.
- ❓ **Accepting a friend/family request** is mutual (both are added to each other's group).
- ✅ **Web ↔ app identity (decided 2026-09-27):** both use a random unique 9-digit Private ID + 5-digit PIN; the readable ID stays server-side. See [private_id_and_login.md](private_id_and_login.md).

**Accounts still needed from the founder:** Firebase Blaze (when going public), Apple Developer, Google Play Console ($25). Mentor phone: +91-8287696616 (recorded).

---

## 17. Firebase on the free Spark plan (parked 2026-09-28)

*Added 2026-09-27. Firebase project `qumanity-55a4a`, project number / sender id `927084635746`.*

### 17.1 What Spark allows (checked in Firebase docs, 2026-09-27)

| Service | Spark | Consequence for testing |
|---|---|---|
| Cloud Functions | ❌ deploy needs Blaze | `functions/` is kept for later. Its work is done by the app plus security rules, and by `tools/ops` scripts on your Mac. |
| Cloud Storage | ❌ new projects need Blaze | chats are **text-only** until Blaze |
| Phone Auth | ✅ with **test phone numbers**; real SMS is billed | your own number plus up to 9 fictional numbers, each with a fixed code |
| Firestore | ✅ 20k writes, 50k reads, 20k deletes a day; 1 GiB storage | seeding is planned around the write limit |
| FCM push | free, but needs a server to send | live updates come through Firestore listeners; push notifications come with Blaze |
| App Distribution | ✅ free, up to 500 testers | used to share the Android APK |

### 17.2 How the app works without functions
- **Registration is one Firestore transaction** built by `shared/src/registration.ts`. The rules accept it only as a whole:
  - the registry numbers must be new;
  - each serial must go up by exactly one;
  - the chain must equal the village's seeded chain;
  - the village group must be active;
  - the user count goes up by one in each group of the chain.
- **Identity for rules:** `uid_links/{authUid}` holds `{ user_id, account_id, chain, village_id }`. It replaces the custom claims that need Admin/Functions.
- **Hidden readable IDs:**
  - The phone writes them once and then cannot read them back.
  - Only the Mentor can read them (`config/roles.owner_user_id`).
- **PIN:**
  - A salted SHA-256 hash is kept in `secrets/{uid}`, which no client can read.
  - A new phone proves the PIN by a `pin_checks` write, which the rules accept only when the hash matches.
  - The phone keeps its own copy in the Keystore for offline unlock, together with the wrong-try lock.
  - With Blaze this moves to the scrypt server function.
- **Votes:** the voter's vote and the post score change in the same transaction, and the rules check the arithmetic. The deadline is worked out from `voting_start` plus 7–14 days by level.
- **Admin work** is done by `tools/ops` with the Admin SDK and your service-account key:
  - seed locations and groups
  - reserve the Mentor ID
  - deploy the rules
  - later, close voting windows, approve Social Workers and reveal IDs

### 17.3 Pilot area and seeding (`npm run ops -- plan --pilot CS.DL`)
**Seeded everywhere**
- Earth, the 7 continents and 229 countries, so a birth place can be anywhere.
- Every tier down to Tehsil in all 10 Sub-continent countries: 14 zones, 138 states, 1,642 districts and 11,198 tehsils.

**Seeded for the pilot only (Delhi, `CS.DL`)**
- All **2,551 villages**.
- **2,696 groups**: every Delhi village, tehsil and district, plus Delhi, the Central zone, India, Asia and Earth.
- You are in seat 1 (Mentor) of every one, so all of them are active.

**Cost**
- 21,174 writes in total, which is **2 runs on 2 days**. The script stops at 19,000 writes and resumes from where it stopped.
- More pilot areas can be added later, e.g. `--pilot CS.DL,NP.BA`.

Present-location pickers show only places that have groups, so testers can only choose pilot villages.

### 17.4 Your to-dos (in this order)
1. **Firestore:** Firebase console → Build → Firestore → *Create database*. Choose **Production mode** and location **asia-south1 (Mumbai)**. The location cannot be changed later.
2. **Phone sign-in:** Authentication → Sign-in method → Phone → *Enable*. Under **Phone numbers for testing**, add:
   - your own number `+91 82876 96616` with a 6-digit code only you know;
   - up to 9 fictional numbers (e.g. `+91 55555 00001`) with codes, one per tester.
3. **Android app:** Project settings → *Add app* → Android, with package name `org.qumanity.app`.
   - Download `google-services.json` into `Qumanity_App/mobile/`.
   - After the first EAS build, add the SHA-1 and SHA-256 from `npx eas-cli credentials`.
4. **Admin key for `tools/ops`:** Project settings → Service accounts → *Generate new private key*.
   - Save it **outside** the project, e.g. `~/.qumanity/service-account.json`.
   - Never share or commit it.
5. **Expo account** (free) for cloud builds: sign in with `npx eas-cli login`, then run `npx eas-cli init` in `mobile/`.
6. **App Distribution:** Firebase console → Release & Monitor → App Distribution → *Get started*. Add testers by email.

### 17.5 Commands once the to-dos are done
```bash
cd ~/Desktop/Qumanity_App/tools/ops
export GOOGLE_APPLICATION_CREDENTIALS=~/.qumanity/service-account.json
npm run ops -- deploy-rules
npm run ops -- seed --pilot CS.DL --owner-phone +918287696616   # day 1, run again on day 2
npm run ops -- status

cd ../../mobile
npx eas-cli build -p android --profile preview    # APK in the cloud (about 15 min)
```
Upload the APK to App Distribution in the console, or use `firebase appdistribution:distribute`.

**First sign-in:**
1. Install the APK on your Android phone.
2. Sign in with your number and your test code.
3. Create your PIN and register with a Delhi pilot village.

Registering claims the reserved Mentor User ID, so you are Mentor of every pilot group.

### 17.6 iOS later
The code is cross-platform already, and the bundle id `org.qumanity.app` is reserved in `app.json`. When you are ready:
1. Add an iOS app in Firebase and put `GoogleService-Info.plist` into `mobile/`. Add `ios.googleServicesFile` back to `app.json`.
2. Get an Apple Developer account.
3. Run `npx eas-cli build -p ios`, then distribute through TestFlight or App Distribution.

---

## 18. Website (Qumanity_DPG) ↔ phone app ↔ 0_Earth — one system

*Added 2026-09-27.* The website is the **web version of this app**: same accounts, groups, posts, votes and council, same location data in `Desktop/0_Earth`.

### 18.1 What already exists on the website (Flask + SQLite, `Desktop/Qumanity_DPG`)
- **Collective Board** on the Public and Global dashboards: a group-chat style feed for the level chosen above it (Village … Earth). Read + vote everywhere; **posting only in the Village**; comments only after voting closes. Rules and windows are in `board_core.py` and are **the same table as §8** (7–14 days, +10 … +100,000,000). Removed posts are saved in the author's Private timeline.
- **Q-Punch icon** on every board: the 5 council seats of that group (Mentor auto-filled) and progress towards the residents needed for elections.
- **Language:** every user has at most 3 — mother tongue, English, and an optional daily-use language chosen in Private settings. The dashboard and the poems marquee switch between them.
- **Time-box, Kundali** and the redesigned Private profile.

### 18.2 One source of truth
| Data | Source of truth | Website | Phone app |
|---|---|---|---|
| Locations, IDs of places | `Desktop/0_Earth` (`Qumanity_Master.json`) | reads static JSON | seeded into Firestore by `tools/ops` |
| Users, groups, posts, votes, comments, requests | **Firestore** (`qumanity-55a4a`) | *today* SQLite; **target** Firestore via the Admin SDK on the Flask server | Firestore SDK |
| Council, elections | Firestore | read | read |

**Recommended path:** keep the website's SQLite as a local prototype until the app's Phase 2 (seed) is done, then move `board_core.py` behind a small storage interface and switch it to Firestore (Admin SDK, service-account key kept outside the repo) so a post made on the phone appears on the site and the reverse.

### 18.3 Identity bridge (decision needed)
The website's Private ID (`N1R-DU-GFA3-ZAI-BD.1`) is the *readable* format the app keeps hidden. Proposal: the website keeps password login, and each website user gets the same random **9-digit User ID** and **10-digit Account ID** the app uses; the readable form stays server-side. Phone number becomes an optional link so one person is one account on both.

### 18.4 Next steps
1. Decide §18.3.
2. Add the storage interface in `board_core.py` and a Firestore adapter.
3. Generate the 10-digit Account IDs on the website and expose search by Account ID.
4. Build Private-timeline chat and the friend / family / message requests on the website, mirroring §10.

---

## 19. Qoins wallets, donations, referrals and post pricing

*Added 2026-09-27.* Specified in separate files so the app and the website share them (identical copies in `Qumanity_DPG/docs/`):
[qoins_wallet_system.md](qoins_wallet_system.md) · [donation_distribution.md](donation_distribution.md) · [referral_system.md](referral_system.md) · [post_rewards.md](post_rewards.md) · [post_types_pricing.md](post_types_pricing.md) · [voting_logic.md](voting_logic.md) · [transaction_history.md](transaction_history.md) · [election_history.md](election_history.md) · [sub_groups.md](sub_groups.md) · [user_restrictions.md](user_restrictions.md) · [qpunch_council.md](qpunch_council.md).

**Spark-plan consequences for the app**
- Text posts, votes, rewards and wallet arithmetic run in the client transaction checked by the rules, like votes (§17.2).
- **Media posts (image, audio, video) need Cloud Storage → Blaze.** Until then the app offers text only and shows the media prices as "coming soon".
- **Payment verification by webhook and payouts to volunteers need Blaze.** On Spark, cash payments are confirmed by the volunteer entering their own Private ID.
- The Monday-00:00 weekly history is computed when read; no scheduler is needed.

**Decisions waiting for the founder** are listed in the table at the end of `qoins_wallet_system.md` (free-account split, Earth participant reward, Mauritius, Earth winner rule).

---

## 20. Personal timeline, search, and account recovery

*Added 2026-09-27.* Full spec: [personal_timeline_and_social.md](personal_timeline_and_social.md) (identical copy in `Qumanity_DPG/docs/`).

- Every Account ID (one per present-location stay, kept forever) gets a permanent 12-digit public search code; the current one shows on the Public profile.
- 5 owned group chats per user: Family, Friends, Business/Profession (with a business name/sector/services), and two freely-named Custom groups. Only the owner invites; invitees must accept.
- One-time message requests -> a private one-to-one chat once accepted.
- Wallet weekly history (Monday-Sunday), 3 months for everyone, full history for council (placeholder: gated by admin until real elected council seats exist above the pilot village).
- Election history: Lok Sabha/Vidhan Sabha are optional free text; Q-Punch history is read from the user's real ballots, never typed.
- Forgotten PIN: self-service by OTP to a phone/email already on file (simulated — no SMS/email provider connected yet). Forgotten Private ID: never self-service; a reviewed, audited, physical-mail-only process.

---

## 21. App on the website backend (2026-09-28)

**Decisions (founder, 2026-09-28)**
- The website is the backend.
- Testing is on the same Wi-Fi.
- The website's 5 council seats are kept.
- The website's 12-digit search code is used.

**Built**
- **App (`mobile/`, Expo SDK 57, runs in Expo Go):**
  - sign-in with the 9-digit Private ID + PIN; registration wizard (Personal details → Global account → Public account → Review with optional donation → Private ID shown once)
  - Forgot PIN and Forgot Private ID
  - dashboard with Global, Public, Personal and Private tabs
  - Collective Board: Live voting, ❄ Frozen, free Village posts, paid Tehsil → Zone posts with a price confirmation, comments after voting
  - Q-Punch council sheet and group wallet on every level
  - Groups drawer: village sub-groups, or the places below with statistics
  - Personal: 5 groups, requests inbox, search by 12-digit code, invitations, message requests
  - Private: masked Private ID (PIN to show for 30 s), search code, profile, message box, removed posts
  - Wallet (balance, Qoins, simulated donation, weekly history), Election history, Settings (daily language, change PIN)
- **Website additions:** bearer tokens for the app, `/api/me`, `/api/user/pin`, `QM_HOST`, and a fix so new accounts are searchable at once ([phone_app_api.md](phone_app_api.md)).
- **Checks:**
  - `tools/website-check/check_app_api.py`: 58 API checks on a temporary database copy
  - `mobile` `npm test`: location tree against the website's data files
  - typecheck, and Android and web bundles

**Open issues found**
1. **Website and 0_Earth disagree on India's place ids.**
   - The website's India data (`static/data/india_districts_tehsils.json`) numbers places differently from `0_Earth/Qumanity_Master.json`. For example, `CS.DL.5.4` is Bawana on the website but Kondli in 0_Earth.
   - `folder_connector` writes user folders by id, so website/app users can land in the wrong 0_Earth village folder.
   - This needs a decision before more real users register: which numbering is the source of truth?
2. **Two different donation splits.**
   - The wallet's "Donate" (`/api/wallet/donate`) uses the registration donation split (8 tiers).
   - `qoins_wallet_system.md` describes an independent top-up split (own 60% / village 40%, `qoin_core.topup_split`), which is not wired to any route yet.
3. **Default secret key.** If `QM_SECRET_KEY` is not set, the website uses a known development key, so sessions and app tokens could be forged. Always set it (the testing guide does).

