# BryceLearning — iOS App Roadmap

> **Goal:** Turn BryceLearning into a native iOS app with a subscription model where parents can photograph textbook pages and the AI generates practice questions for their kids.

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

**Output:** App opens, shows the existing BryceLearning game inside a native shell.

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
- [ ] 3.1 Add Expo Camera + ImagePicker permissions
- [ ] 3.2 Build "Add New Section" screen with camera/photo library picker
- [ ] 3.3 Set up OpenAI API (GPT-4o Vision) in a secure backend route
  - Never expose the API key on the client
  - Create a simple serverless function (Supabase Edge Function or Vercel)
- [ ] 3.4 Build the AI prompt pipeline:
  - Send image to GPT-4o Vision
  - Prompt: *"You are a 4th grade teacher. This is a textbook page. Generate 9 multiple-choice practice questions a student can answer after studying this page. Return JSON: `{ title, unit, questions: [{ question, options: [A,B,C,D], correctIndex }] }`"*
- [ ] 3.5 Show preview of generated questions — parent can edit/delete before saving
- [ ] 3.6 Save approved questions to Supabase as a custom unit
- [ ] 3.7 Custom units appear in the child's app alongside built-in units
- [ ] 3.8 Add loading/processing UI (scanning animation)

**Output:** Parent scans page → 9 questions appear in kid's game within ~10 seconds.

---

## Phase 4 — Subscription

**Goal:** Free tier for built-in units; paid tier ($4.99/month) unlocks AI scanning + unlimited custom units.

### Steps
- [ ] 4.1 Create Apple App Store Connect account + app listing
- [ ] 4.2 Set up **RevenueCat** (handles App Store receipt validation, webhooks)
- [ ] 4.3 Define subscription products in App Store Connect:
  - `com.brycelearning.monthly` — $4.99/month
  - `com.brycelearning.yearly` — $39.99/year (save 33%)
- [ ] 4.4 Build Paywall screen (show features, pricing, restore purchases)
- [ ] 4.5 Gate "Scan a Textbook" feature behind subscription check
- [ ] 4.6 Free tier: all built-in units playable, no scanning
- [ ] 4.7 Sync subscription status to Supabase via RevenueCat webhook
- [ ] 4.8 Add "Restore Purchases" button

**Output:** App is monetized. Free users can play all existing content. Subscribers can scan new content.

---

## Phase 5 — Polish & COPPA Compliance

**Goal:** App is safe for children and looks great.

### Steps
- [ ] 5.1 Add parental consent gate (parent must create account, not child)
- [ ] 5.2 Write Privacy Policy (no data collected from under-13 without parent consent)
- [ ] 5.3 Write Terms of Service
- [ ] 5.4 Add app icon (1024x1024) and splash screen
- [ ] 5.5 Add onboarding flow (3-screen intro for new parents)
- [ ] 5.6 Test on real iPhone device via TestFlight
- [ ] 5.7 Fix any UI issues on different screen sizes (SE, 15 Pro Max)
- [ ] 5.8 Add haptic feedback on correct/wrong answers

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

## Current Status

See [CHANGELOG.md](./CHANGELOG.md) for detailed progress log.
