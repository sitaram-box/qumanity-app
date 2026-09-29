# Testing the Qumanity app on your phone

*2026-09-28 · phone and Mac on the same Wi-Fi · no Firebase, no build, no accounts needed*

The app talks to the Qumanity **website running on your Mac**. You and the app share the same accounts, boards, wallets and chats. Anything you do on the phone shows up on the website, and the other way round.

## 1. Start the website so phones can reach it
```bash
cd ~/Desktop/Qumanity_DPG
QM_HOST=0.0.0.0 QM_ADMIN_PRIVATE_IDS=014918240 QM_SECRET_KEY='choose-a-long-random-phrase' python3 app.py
```
- The first time, macOS may ask whether Python may accept incoming connections. Choose **Allow**.
- Keep `QM_SECRET_KEY` the same every time. It signs the app's sign-in tokens; if it changes, everyone has to sign in again.
- Your Mac's Wi-Fi address is shown by `ipconfig getifaddr en0`, for example `192.168.1.20`. The website is then at `http://192.168.1.20:5050`.

## 2. Start the app
```bash
cd ~/Desktop/Qumanity_App/mobile
npx expo start
```
1. On your Android phone, install **Expo Go** from the Play Store. It is free and needs no account.
2. In Expo Go, choose *Scan QR code* and scan the code shown in the terminal. Qumanity opens.
3. On the Sign-in screen, the dot next to "Server" should be **green**. If it is red, tap *Change* and enter `http://<your Mac's address>:5050`.

An iPhone works the same way: scan the code with the Camera app, and it opens in Expo Go.

## 3. What to test

| # | Test | Expected |
|---|---|---|
| 1 | **Sign in** with the Founder ID `014918240` and your PIN | Dashboard with 4 tabs: Global · Public · Personal · Private |
| 2 | **Private** → *Show* next to the Private ID | asks for the PIN, shows the ID for 30 seconds, then hides it again |
| 3 | **Public** → Village → write a post | appears under *Live voting* with 7 days to vote |
| 4 | Sign out, **Create my Qumanity account** for a second person in the same village | 4 steps; at the end the 9-digit Private ID is shown once, with a Copy button |
| 5 | Second person votes +1 on the first post | score goes to +1; the website board shows the same |
| 6 | **❄ Frozen** button (bottom-right of the board) | switches to frozen and elevated posts; *← Live voting* goes back |
| 7 | **Q-Punch** icon | the 5 seats (Founder/Admin, Male Leader, Female Leader, Managers, Agents & Volunteers) and the residents needed for elections |
| 8 | **Groups** icon (☰) | in the Village: village sub-groups; higher up: the places below, with statistics |
| 9 | **Personal** → find the other person by their 12-digit search code (shown on their Private tab) → send a message request | it appears in their *Requests*; *Accept* opens a private chat in the Private tab |
| 10 | Invite them to your **Family** group | they accept; both can chat in it |
| 11 | **Private → Wallet** → Donate 20 | balance and weekly history update. This is testing only: no real money moves |
| 12 | **Private → Settings** → change PIN | the new PIN works on the phone and on the website |
| 13 | Wrong PIN 5 times | the ID is locked for 15 minutes |

## 4. Building an installable APK (later)
Expo Go is the quickest way to test. When you want an app icon on the phone, or testers who don't use Expo Go:
1. Create a free Expo account, then run `npx eas-cli login` and `npx eas-cli init` in `mobile/`.
2. Run `npx eas-cli build -p android --profile preview`. This builds an APK in the cloud and gives you a download link. Share the link, or upload the APK to Firebase App Distribution.
3. An APK still reaches the website over the Wi-Fi address, so the app needs `usesCleartextTraffic` enabled for plain `http://`. Alternatively, put the website behind https, for example with a Cloudflare Tunnel.

`expo-cli` and `expo build:android` were retired by Expo; `eas build` replaces them.

## 5. What is not in the app yet
- Photos, audio and video posts, and top-ups with real money. The website doesn't have them yet either; they need file storage and a payment provider.
- Push notifications. Boards and chats refresh when opened, and chats refresh every 4 seconds.
- SMS or email codes. "Forgot PIN" shows the code on screen only when the website is started with `QM_DEV_SHOW_OTP=1`, which is for testing only.

## Election pilot — Rohini Sector 24 (from 2026-09-29)
- 500 demo residents live in Rohini Sector 24 (60% Yuvak, 25% Vridh, 15% Balak; half men, half women). **Demo PIN for all: `24024`.** Their Private IDs, signs and ages are listed in `Qumanity_DPG/docs/ELECTION_PILOT.md`.
- Week 1 (23–30 Sep, Libra) is running: 3 male + 3 female Libra candidates were picked at random.
- To test as a voter: sign in with a **Libra** demo member → Public → Village → **Q-Punch**. Other signs see when their own month starts.
- Weeks 2–3 (from 1 Oct): `python3 scripts/seed_election_demo.py --vote` casts every eligible Libra member's vote at random (or vote yourself as a demo Libra member in the app).
- Week 4 (from 15 Oct): Q-Punch shows the winners and their 1-year term.
- Remove all demo users: `python3 scripts/seed_election_demo.py --remove` (it backs up the database first).
