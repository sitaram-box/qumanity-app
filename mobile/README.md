# Qumanity phone app (`mobile/`)

React Native + Expo (SDK 57, Expo Router, TypeScript). The app is a **client of the Qumanity
website** (`qumanity-web` / `Desktop/Qumanity_DPG`), which is the only backend: every screen calls
the website's JSON API with a Bearer token from sign-in (9-digit Private ID + 5-digit PIN).
The full contract is in [`../docs/phone_app_api.md`](../docs/phone_app_api.md).

## Run it on your Android phone (same Wi-Fi as the Mac)

1. **Start the website on the Mac, reachable from the phone.** The port is 5050, not Flask's default 5000:

   ```bash
   cd ~/Desktop/Qumanity_DPG && QM_HOST=0.0.0.0 python3 app.py
   ```

2. **Point the app at the Mac.** Create `mobile/.env`; it is git-ignored:

   ```bash
   EXPO_PUBLIC_API_BASE_URL=http://<Mac LAN IP>:5050
   ```

   Find the IP with `ipconfig getifaddr en0`. It changes when the router gives the Mac a new
   address: update `.env`, then restart Expo. Without `.env`, development builds guess the Mac from
   the Expo bundle address.

   **Release builds always use `https://qumanity.in`**, and `.env` can't change that.

3. **Start Expo for the local network:**

   ```bash
   cd ~/Desktop/Qumanity_App/mobile && npx expo start --lan
   ```

4. On the phone, install **Expo Go** (Play Store) and scan the QR code.

5. On the sign-in screen, check the server address. A previously saved address overrides
   everything above.

Test accounts: the election demo members in `Qumanity_DPG/docs/ELECTION_PILOT.md` (PIN `24024`).

## Checks

```bash
npm run typecheck                                           # TypeScript
npm test                                                    # unit tests (vitest)
python3 ../tools/website-check/check_app_api.py             # every API call the app makes, against the website code
```

The website check runs on a **temporary copy** of the website database and a temporary `0_Earth`
folder, so it is safe to run at any time.

## Folder map

```
src/
  app/                    screens (Expo Router: file = route)
    _layout.tsx           root: fonts, sign-in gate (Stack.Protected), keyboard + bottom marquee
    (tabs)/               the 4 timelines: global, public, personal, private
    welcome, login, register/*, forgot-pin, recover-id      signed-out screens
    chat/[kind]/[id]      one chat screen for village sub-groups, personal groups, private chats
    family-tree           Family Tree: one family unit at a time
    family-activate       Build your Family Tree: the 6-step Activation wizard (same payloads as the website)
    groups/*, private-groups, notifications, account-ids, wallet, settings, …
  api/
    client.ts             server address, token, api() JSON calls, upload() multipart, authHeaders()
    qumanity.ts           typed calls for every website endpoint the app uses
    locations.ts          location tree (Earth → village) for the pickers
  components/
    ui.tsx                design system: Screen, Button, Field, Card, ListRow, …
    Avatar.tsx            <Avatar user={{name, gender, profile_picture_url}} size={40} />
    MembersSheet.tsx      group Members list (name, gender, age group, place, Admin/Member)
    PublicIdInvite.tsx    "Add by Public ID": look up 12 digits, confirm the person, invite
    Board.tsx, LevelPage.tsx, QPunchSheet.tsx, ElectionCard.tsx, …   timeline building blocks
  lib/remembered.ts       this phone's remembered Private ID and Public ID (never the PIN)
  state/app.tsx           sign-in state, the signed-in member (me), registration draft
  theme/index.ts          colours, type scale, spacing
```

## Conventions

- **Avatars:** always `<Avatar user={…} />`. Picture requests carry the sign-in header, because
  the website decides per viewer; a 404 shows initials and a gender badge.
- **Sign-out rule:** the app signs out only on a 401 or the website's login page. Any other error
  page is shown as an error (`client.ts`).
- **Keyboard and marquee:** handled once in `app/_layout.tsx`. Screens must not add a
  `KeyboardAvoidingView`.
- **Naming:** the product is "Qumanity" only.
