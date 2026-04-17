# SnapStudy — iOS App Roadmap

> **Goal:** Turn SnapStudy into a native iOS app with a subscription model where parents can photograph textbook pages and the AI generates practice questions for their kids.

---

## Strategy: Expo Hybrid Approach

The existing game logic (HTML/CSS/JS) is powerful and tested. Rather than rebuilding everything from scratch in React Native, we use a **hybrid model**:

- **WebView** — hosts the existing game screens (reuses all question generators, styling, boss battles)
- **Native screens** — auth, camera/photo upload, subscription paywall, account/settings
- **Bridge** — passes data between WebView and native (user ID, progress sync, unlocking premium content)

This gets us to the App Store fastest while still feeling like a real native app.

---

## Phase 1 — Foundation (Expo Setup) ✅ IN PROGRESS

**Goal:** Working Expo project that runs on iOS Simulator.

### Steps
- [x] 1.1 Initialize Expo project (`bryce-app/`)
- [x] 1.2 Install core dependencies (navigation, WebView, icons, camera, image picker)
- [x] 1.3 Configure `app.json` for iOS (bundle ID, name, splash, camera permissions)
- [x] 1.4 Set up folder structure (`/src/screens`, `/src/components`, `/src/services`, `/src/assets`)
- [x] 1.5 Build basic navigation shell (Bottom Tab navigator — Play / Scan / Account)
- [x] 1.6 Embed existing web app in a WebView screen (loads live GitHub Pages deploy)
- [x] 1.7 Build Scan screen placeholder (UI ready, gated behind subscription)
- [x] 1.8 Build Account screen placeholder (guest state, plan card, upgrade button)
- [x] 1.9 Verified project builds cleanly (`npx expo export --platform web` ✅)
- [ ] 1.10 Test on physical device via Expo Go app

**Output:** App opens, shows the existing SnapStudy game inside a native shell.

---

## Phase 2 — User Accounts

**Goal:** Parents can create an account; progress syncs to the cloud.

### Steps
- [x] 2.1 Choose and set up auth provider — **Supabase** (free tier, Postgres, easy to self-host)
- [x] 2.2 Create Supabase project + schema (`kid_profiles`, `progress`, `subscriptions`, `custom_units`, `upsert_progress` RPC)
- [x] 2.3 Build Sign Up / Log In screens (email + password)
- [x] 2.4 WebView bridge intercepts `localStorage.setItem` and posts to React Native
- [x] 2.5 Sync best scores to Supabase on every game save via `upsert_progress` RPC
- [x] 2.6 Load user progress from Supabase, inject into WebView `localStorage` on app launch
- [x] 2.7 Parent account with multiple kid profiles (avatar picker, add/delete, long-press to remove)
- [x] 2.8 Auth-gated navigation: Guest → game direct; Logged in → KidSelect → game
- [x] 2.9 Active kid banner shown above the game WebView

**Output:** Progress saves to the cloud. Works across devices. Multiple kid profiles per family.

---

## Phase 3 — Camera + AI Question Generation

**Goal:** Parent photographs a textbook page → AI generates 9 practice questions → added to the app.

### Steps
- [x] 3.1 Add Expo Camera + ImagePicker permissions
- [x] 3.2 Build ScanScreen — camera capture or photo library picker with image preview
- [x] 3.3 Supabase Edge Function (`generate-questions`) — securely calls GPT-4o Vision, OpenAI key stays server-side
- [x] 3.4 AI prompt pipeline — sends base64 image, returns `{ title, questions: [{ question, options, correctIndex }] }`
- [x] 3.5 Question preview + inline editor — edit text, swap correct answer, remove questions
- [x] 3.6 Save to Supabase `custom_units` table
- [ ] 3.7 Custom units appear in the child's game (Phase 3 follow-up)
- [x] 3.8 Scanning loading state with spinner and status message
- [x] 3.9 Multi-page scanning (up to 6 pages per unit, thumbnail strip UI)
- [x] 3.10 Image content validation (GPT rejects non-educational images with explanation)
- [x] 3.11 Auto-remove rejected images — when an image fails content validation, automatically delete it from the staging array instead of leaving it highlighted with an error card

**To activate Phase 3:**
1. Get an OpenAI API key at platform.openai.com
2. Install Supabase CLI: `npm install -g supabase`
3. Run: `supabase functions deploy generate-questions --project-ref vwyhxnaunkbrxuzjxpzt`
4. Set secret: `supabase secrets set OPENAI_API_KEY=sk-... --project-ref vwyhxnaunkbrxuzjxpzt`

**Output:** Parent scans page → 9 questions appear in kid's game within ~10 seconds.

---

## Backlog / Nice-to-Have

> Small items that don't fit into a specific phase yet.

- [x] **Remove PIN without sign-out** — "Remove PIN lock" button now available in AccountScreen; clears the PIN immediately after a confirmation prompt
- [ ] **Forgot PIN recovery flow** — forgetting the PIN still requires signing out. Add an email-based recovery flow (Supabase magic link or OTP) so parents can reset without losing their account.

---

## Phase 4 — Subscription ⏳ DEFERRED (moved to last)

> **Why deferred:** Internal testing and beta distribution will run without a paywall so all functionality can be validated end-to-end. Subscriptions will be layered in after Phase 8 once the app is stable and battle-tested.

**Goal:** Free tier for built-in units; paid tier ($4.99/month) unlocks AI scanning + unlimited custom units.

### Steps
- [ ] 4.1 Create Apple App Store Connect account + app listing
- [ ] 4.2 Set up **RevenueCat** (handles App Store receipt validation, webhooks)
- [ ] 4.3 Define subscription products in App Store Connect:
  - `com.snapstudy.monthly` — $4.99/month
  - `com.snapstudy.yearly` — $39.99/year (save 33%)
- [ ] 4.4 Build Paywall screen (show features, pricing, restore purchases)
- [ ] 4.5 Gate "Scan a Textbook" feature behind subscription check
- [ ] 4.6 Free tier: all built-in units playable, no scanning
- [ ] 4.7 Sync subscription status to Supabase via RevenueCat webhook
- [ ] 4.8 Add "Restore Purchases" button

**Output:** App is monetized. Free users can play all existing content. Subscribers can scan new content.

---

## UI Redesign Note
> Flagged for Phase 5 — current UI is functional but needs a full visual redesign pass before App Store launch.

---

## Phase 5 — Polish & COPPA Compliance

**Goal:** App is safe for children and looks great.

### Steps
- [x] 5.1 Add parental consent gate — "I confirm I am a parent or guardian (18+)" checkbox on signup
- [x] 5.2 Write Privacy Policy — COPPA-compliant, covers OpenAI image processing, data deletion rights
- [x] 5.3 Write Terms of Service — parental account requirement, content rules, subscription terms
- [x] 5.4 Add app icon and splash screen — using `assets/appicon.png` across icon, adaptive icon, and splash (swap for final artwork before App Store submission)
- [x] 5.5 Add onboarding flow — 3-slide animated intro, shown once per install
- [ ] 5.6 Test on real iPhone device via TestFlight
- [ ] 5.7 Fix any UI issues on different screen sizes (SE, 15 Pro Max)
- [x] 5.8 Add haptic feedback on correct/wrong answers (expo-haptics)

**Output:** App feels polished and passes App Store child safety review.

---

## Phase 6 — App Store Launch

**Goal:** App is live on the App Store.

### Steps
- [ ] 6.1 Create App Store screenshots (6.5" and 5.5" required)
- [ ] 6.2 Write App Store description and keywords
- [ ] 6.3 Set age rating (4+, parental consent for account creation)
- [ ] 6.4 Submit for App Store Review
- [ ] 6.5 Respond to any review feedback
- [ ] 6.6 Launch! 🚀

---

## Phase 7 — Growth, Hardening & Engagement

**Goal:** Make SnapStudy resilient, secure, and worth coming back to every day.

> Items are grouped by priority. Bug fixes and security should be resolved before or alongside Phase 5/6; UX and growth features are post-launch priorities.

---

### 7.A — Bug Fixes (Ship Blockers)

- [x] 7.1 Guard QuizScreen against zero-question units — show a friendly error instead of dividing by zero
- [x] 7.2 Clear `setTimeout` in QuizScreen `handleAnswer` on component unmount to prevent ghost state updates
- [x] 7.3 Clamp `correctIndex` in QuizScreen to valid range so an out-of-bounds value never silently marks the wrong answer correct
- [x] 7.4 Replace hardcoded "Bryce" in ScanScreen success copy with the active kid's name (or a generic fallback)
- [x] 7.5 Clear parent PIN from device storage on sign-out so it doesn't carry over to another account on the same device
- [x] 7.6 Rename `@brycelearning_parent_pin` AsyncStorage key to `@snapstudy_parent_pin` for brand consistency

---

### 7.B — Security & Safety

- [x] 7.7 Add per-user rate limiting to the `generate-questions` Edge Function — max 20 scans/day, HTTP 429 on exceed
- [x] 7.8 Upgrade PIN storage from AsyncStorage to `expo-secure-store` — PIN encrypted at rest on Android
- [x] 7.9 Privacy Policy screen — covers OpenAI image processing, COPPA, data deletion (done in Phase 5)
- [ ] 7.10 Wire `getSubscriptionStatus()` into ScanScreen — deferred to Phase 4
- [x] 7.11 Remove development `console.log` statements that expose user IDs and Supabase keys

---

### 7.C — UX & Polish

- [x] 7.12 Show a visible error state (with retry button) on HomeScreen when unit loading fails
- [x] 7.13 Show a visible error state on KidSelectScreen when kid profiles fail to load
- [x] 7.14 Wire up Privacy Policy and Terms of Service rows in AccountScreen (done in Phase 5)
- [x] 7.15 Upgrade button shows beta alert — "All features free during testing"
- [x] 7.16 First-run onboarding flow — 3-slide animated intro (done in Phase 5)
- [x] 7.17 Search / filter bar on HomeScreen — appears at 3+ lessons, filters by title
- [x] 7.25 Rename "unit" → "lesson" throughout all user-facing UI text
- [x] 7.26 "Go to Learn" button on ScanScreen save-success screen — navigates directly to Learn tab
- [x] 7.27 Keyboard-aware modals — `KeyboardAvoidingView` added to Edit Profile modal and ScanScreen question editor so keyboard no longer covers content
- [x] 7.28 Avatar system replaced with colour + initial — `KidAvatar` component, 12-colour picker, live preview in add/edit forms; DB stores hex colour
- [x] 7.29 Rich visual questions — GPT freely composes emoji/unicode visuals in question text; scaled 1–4 per lesson by count
- [x] 7.30 Hint system — GPT generates a hint per question; 💡 button reveals it with animated fade-in
- [x] 7.31 Read-aloud TTS — 🔈 button reads question aloud via `expo-speech`; auto-stops on answer/navigation
- [x] 7.32 Markdown rendering — question text rendered via `react-native-markdown-display` (bold, tables, code, line breaks)
- [x] 7.33 SVG geometry — optional `geometry` object (pie, bar, shape) rendered with `react-native-svg` above question text
- [x] 7.34 Per-question regenerate — 🔄 button in review step swaps any question without re-scanning; separate `regenerate` mode in edge function
- [ ] 7.18 Allow lessons to be assigned to a specific child so siblings see their own content

---

### 7.D — Engagement & Retention

- [x] 7.19 Save quiz results to Supabase — `quiz_results` table tracks score, stars, kid, unit, and timestamp
- [ ] 7.20 Kid-level progress dashboard for parents — simple summary of scores and activity across all units
- [ ] 7.21 Streak tracking — reward kids for studying on consecutive days with a visual streak counter
- [ ] 7.22 Push notifications — optional daily "time to study!" reminder, configurable per kid
- [ ] 7.23 Offline mode — cache loaded units locally so kids can take a quiz without Wi-Fi
- [ ] 7.24 Unit sharing — let parents share a unit with another SnapStudy family (premium feature, great for classrooms)

---

**Output:** A stable, secure app that keeps kids coming back and gives parents real insight into their child's progress.

---

## Phase 8 — Boss Battles, Mini-Games & À La Carte Purchases

**Goal:** Reward kids who finish a quiz with an unlockable boss battle or mini-game. Parents choose which games attach to each unit. Individual games are purchasable à la carte — a second monetization track alongside the subscription.

> This revives the best mechanic from the original web game and turns it into a native, extensible game engine.

---

### 8.A — Boss Battle Reward System

- [ ] 8.1 After a quiz is completed with 2+ stars, show a "Boss Unlocked!" celebration screen with the boss name and artwork
- [ ] 8.2 Boss battle is a timed rapid-fire quiz pulling 10–15 random questions from the same unit — harder, faster, no going back
- [ ] 8.3 Boss has an animated health bar that depletes on correct answers and ticks back up on wrong ones — visual tension
- [ ] 8.4 Defeating the boss awards a trophy/badge saved to the kid's profile in Supabase
- [ ] 8.5 Trophies visible on the kid's HomeScreen card and on the progress dashboard (Phase 7.20)
- [ ] 8.6 Parent can toggle boss battles on/off per unit (some kids may find them stressful)

---

### 8.B — Mini-Game Library

> Each mini-game is a self-contained native component that receives the unit's questions/answers as props and reports a score back. New games can be added without changing the quiz or unit data model.

- [ ] 8.7 **Word Scramble** — scrambled answer words, kid taps letters to unassemble; uses correct answer text from unit
- [ ] 8.8 **Flash Cards** — flip card animation; kid self-rates "Got it / Not yet"; tracks retention over sessions
- [ ] 8.9 **Speed Round** — 60-second blitz, one question at a time, counts how many answered correctly under pressure
- [ ] 8.10 **Match-Up** — drag-and-drop matching of questions to answers (great for vocab/definition units)
- [ ] 8.11 **True or False** — simplified binary version; good for younger kids or warmup before a full quiz
- [ ] 8.12 **Memory Flip** — tile-flip matching pairs of question + answer cards (concentration-style)

---

### 8.C — Parent Game Selector

- [ ] 8.13 On the unit detail screen, parent can assign a "reward game" that unlocks after the quiz (boss battle or any mini-game)
- [ ] 8.14 Parent can queue multiple games in order (e.g., quiz → speed round → boss battle)
- [ ] 8.15 "Surprise me" option — app randomly picks an unlocked game as the reward each time
- [ ] 8.16 Per-unit game settings are stored alongside the unit in Supabase `custom_units` (extend the table with a `reward_config` JSON column)

---

### 8.D — À La Carte In-App Purchases

> Parents who don't want a subscription can buy individual games as one-time purchases. Subscribers get all games included.

- [ ] 8.17 Define individual IAP products in App Store Connect:
  - `com.snapstudy.game.bossbattle` — Boss Battle engine — $1.99 one-time
  - `com.snapstudy.game.speedround` — Speed Round — $0.99 one-time
  - `com.snapstudy.game.matchup` — Match-Up — $0.99 one-time
  - `com.snapstudy.game.flashcards` — Flash Cards — $0.99 one-time
  - `com.snapstudy.game.bundle` — All Mini-Games Bundle — $3.99 one-time
- [ ] 8.18 Gate each mini-game behind its purchase (or active subscription) using RevenueCat entitlements
- [ ] 8.19 "Try it free" — each game allows one free play per unit so kids can see what they're missing before parents buy
- [ ] 8.20 Restore purchases button surfaces per-game purchase history (Apple requires this)
- [ ] 8.21 Game Store screen inside the app — preview each game with a short GIF/animation and a buy/try button
- [ ] 8.22 Gifting — parent can share a game purchase code with another family (nice-to-have, App Store supports this)

---

**Output:** Kids have a reason to finish every quiz and come back for more. Parents have flexible, low-friction ways to pay for exactly what they want. Each new game added to the library is a new revenue stream with zero new infrastructure.

---

## Tech Stack Summary

| Layer | Technology | Why |
|---|---|---|
| Mobile app | Expo (React Native) | Cross-platform, fast iteration, OTA updates |
| Game content | WebView (existing HTML/JS) | Reuses all existing work |
| Auth + Database | Supabase | Free tier, Postgres, real-time, edge functions |
| AI vision | OpenAI GPT-4o Vision | Best image understanding, reliable JSON output |
| Subscriptions | RevenueCat | Handles App Store complexity, great free tier |
| Backend API | Supabase Edge Functions | Serverless, co-located with DB, secure API keys |

---

## Cost Estimates (per month at scale)

| Item | Free Tier | At 500 subscribers |
|---|---|---|
| Supabase | $0 (up to 50k users) | $25 |
| OpenAI API | Pay-per-use (~$0.03/scan) | ~$30 (1000 scans) |
| RevenueCat | $0 (up to $2.5k MRR) | $0 |
| Expo EAS Build | $0 (hobby) | $0–29 |
| **Apple's cut** | — | **30%** of revenue |
| **Net at $4.99/mo × 500** | — | **~$1,700/mo** |

---

## UI Redesign Progress

> Phase 5 is the full redesign pass, but individual screens are being improved as bugs are fixed.
> - KidSelectScreen ✅ redesigned (2026-04-17) — larger cards, colored avatars, Account header link; ✅ updated with real character images + edit-profile modal
> - HomeScreen (Play tab) ✅ rebuilt (2026-04-17) — native custom-unit cards, replaces WebView game; ✅ themed + large avatar image above greeting
> - QuizScreen ✅ new (2026-04-17) — dark native quiz with animated progress bar and star results
> - Tab bar ✅ redesigned (2026-04-17) — adapts to active theme (dark/light)
> - ScanScreen ✅ updated (2026-04-17) — multi-page strip, content validation, camera/library prompt; ✅ fully themed
> - AccountScreen ✅ redesigned (2026-04-17) — full dark/light theme, PIN pad themed, Appearance toggle, Remove PIN
> - AuthScreen ✅ redesigned (2026-04-17) — dark theme matching WelcomeScreen

---

## Revised Phase Order

| Phase | Description | Status |
|---|---|---|
| 3.11 + 7.A | Bug fixes — auto-remove rejected images, QuizScreen guards, PIN/branding cleanup | ✅ Done |
| 5 | Polish & COPPA compliance | 🔄 Mostly done (5.6, 5.7 pending — device testing) |
| 7.B–D | Security hardening, UX polish, engagement features | 🔄 In progress |
| **Theme + Avatar** | Dark/light mode system, colour+initial avatars, edit profile | ✅ Done |
| **7.C Polish** | "Lesson" rename, Go to Learn button, keyboard-aware modals, crash fix | ✅ Done |
| **7.D Rich Questions** | Visual emoji questions, hints, TTS, markdown, SVG geometry, per-question regenerate | ✅ Done |
| 6 | App Store Launch (free / no paywall) | Pending |
| 8 | Boss battles, mini-games & à la carte purchases | Pending |
| **4** | **Subscriptions** — added last after beta testing validates all functionality | **Last** |

> Goal: internal testers and beta users get the full app experience unblocked. RevenueCat + Apple IAP review also takes the longest, so starting it last is practical.

---

## Current Status

See [CHANGELOG.md](./CHANGELOG.md) for detailed progress log.
