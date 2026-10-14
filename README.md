# Qumanity — Phone App

Copyright (C) 2026 Rohit Mudgal (individual).
Qumanity Lok LLP is in registration. The IP will be
assigned to the LLP once it is registered.

Qumanity is licensed under the GNU Affero General Public
License v3.0. See LICENSE for details.

Qumanity = **Quantum + Humanity**. This is a WhatsApp-style governance app for Android and iOS. It has location groups from Village to Earth, four timelines, the Quantum Punch Council, and tiered posts that people vote up.

- **Plan:** [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md). Start here.
- **Stack:** Expo SDK 57 (React Native, TypeScript, Expo Router). The backend is the Qumanity website API (Flask, `Desktop/Qumanity_DPG`).

| Folder | What it holds |
|---|---|
| `mobile/` | Expo app (screens in `src/app`, website API client in `src/api`) |
| `tools/website-check/` | Checks the website API the way the app uses it (temporary database copy) |
| `shared/` | Domain logic shared by app, functions and tools (IDs, zodiac, tiers, groups) |
| `functions/` | Cloud Functions for the **Blaze** phase (not deployed while on Spark) |
| `firebase/` | Firestore + Storage security rules, indexes (config in `firebase.json`) |
| `tools/ops/` | Admin scripts run on the Mac: seed from `Desktop/0_Earth`, Mentor reservation, rules deploy, status |

Location data lives only in `Desktop/0_Earth`. The tools read it from there, and the app never bundles a copy.

## How it works now (2026-09-28)

The app is a client of the **Qumanity website** (`Desktop/Qumanity_DPG`), so the website and the phone share the same accounts, wallets, boards, chats and 0_Earth folders.
- Test on the same Wi-Fi with Expo Go: [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md).
- The API contract is in [docs/phone_app_api.md](docs/phone_app_api.md).
- `functions/`, `firebase/`, `tools/ops/` and `shared/src/registration.ts` belong to the parked Firebase design (plan §17). They are kept for push notifications, SMS and hosting later.

## Run it

- **Website for phones:** in `Qumanity_DPG`, run `QM_HOST=0.0.0.0 QM_SECRET_KEY=… python3 app.py`
- **App:** run `npx expo start` in `mobile/`, then scan the QR code with Expo Go.
- **Checks:**
  - `python3 tools/website-check/check_app_api.py` (58 website API checks, on a temporary database copy)
  - `npm test` in `mobile/`
  - `npx tsc --noEmit` in `mobile/`

## License

Qumanity is licensed under the GNU Affero General Public License v3.0. See LICENSE for details.
