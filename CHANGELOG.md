# BryceLearning — Changelog

All notable changes to this project are tracked here.

---

## [Unreleased] — iOS App Development

### Phase 1: Foundation — 2026-04-16

#### Added
- `bryce-app/` — new Expo project scaffolded with blank template (SDK 54)
- Core dependencies installed: `react-native-webview`, `@react-navigation/native`, `@react-navigation/bottom-tabs`, `expo-camera`, `expo-image-picker`, `react-native-safe-area-context`
- `app.json` configured for iOS: bundle ID `com.brycelearning.app`, camera/photo permissions, blue splash screen
- Folder structure: `src/screens/`, `src/components/`, `src/services/`, `src/assets/`
- `App.js` — Bottom Tab navigator with 3 tabs: **Play**, **Scan**, **Account**
- `src/screens/GameScreen.js` — WebView loading the live GitHub Pages deployment of BryceLearning
- `src/screens/ScanScreen.js` — AI scanning placeholder UI (how-it-works steps, gated CTA)
- `src/screens/AccountScreen.js` — Guest profile, subscription plan card, upgrade button, about links
- Build verified: `npx expo export --platform web` exits 0 ✅

#### Next Steps
- Phase 1.10: Test on physical device via Expo Go
- Phase 2: Set up Supabase for user accounts and progress sync ✅ (see below)

---

### Phase 2: User Accounts — 2026-04-16

#### Added
- `bryce-app/.env.example` — template for Supabase env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- `bryce-app/supabase/schema.sql` — full Postgres schema to run in Supabase dashboard:
  - `kid_profiles` table (parent → many kids, with avatar emoji)
  - `progress` table (per-kid per-game best scores, Row Level Security)
  - `subscriptions` table (free/premium status, written by webhook)
  - `custom_units` table (AI-generated questions, Phase 3)
  - `upsert_progress` RPC function (batch score sync, security definer)
- `bryce-app/src/services/supabase.js` — Supabase client (AsyncStorage session, auth helpers, kid/progress/subscription helpers)
- `bryce-app/src/services/progressSync.js` — bridge between WebView localStorage and Supabase:
  - `flattenGameScores()` — parses raw `bryceLearning` JSON into flat score map
  - `handleProgressUpdate()` — saves locally then syncs to cloud
  - `buildLocalStoragePayload()` — rebuilds localStorage JSON from cloud scores for WebView injection
- `bryce-app/src/context/AuthContext.js` — React context managing session, kid profiles, active kid, cloud scores
- `bryce-app/src/screens/AuthScreen.js` — Sign In / Create Account screen (email + password, blue branded UI)
- `bryce-app/src/screens/KidSelectScreen.js` — Kid profile picker (avatar grid, add/delete kids, long-press to remove)
- Updated `bryce-app/src/screens/GameScreen.js` — WebView now:
  - Injects kid's cloud scores into `localStorage` on load
  - Intercepts `localStorage.setItem('bryceLearning', ...)` and posts to React Native
  - Triggers progress sync on every game save
  - Shows active kid's name/avatar in a banner above the game
- Updated `bryce-app/src/screens/AccountScreen.js` — shows real user email, kid profiles with active badge, sign out, manage kids navigation
- Updated `bryce-app/App.js` — `GestureHandlerRootView` + `AuthProvider` + Stack navigator:
  - Guest → MainTabs directly
  - Logged in, no kids → KidSelectScreen
  - Logged in, kid selected → MainTabs
  - Auth and KidSelect always accessible as stack screens

#### Dependencies added
- `@supabase/supabase-js`
- `@react-native-async-storage/async-storage`
- `expo-secure-store`
- `@react-navigation/stack`
- `react-native-gesture-handler`

#### To activate Phase 2
1. Go to [supabase.com](https://supabase.com) → create a free project
2. Run `bryce-app/supabase/schema.sql` in the Supabase SQL Editor
3. Copy `bryce-app/.env.example` → `bryce-app/.env` and fill in your URL + anon key
4. Run `npx expo start` — sign up, add a kid, play!

#### Next Steps
- Phase 3: Camera + GPT-4o Vision for AI question generation

---

## [Web App] — 2026-04-08

### Added
- **Unit 13.1 — Data Displays for Numerical Data**
  - New math unit tab: `📊 13.1 Data`
  - 4 new games: Line Plots, Stem & Leaf, Mode & Range, Data Problems
  - Each game has a 15-question pool (9 served per round)
  - Visual HTML line plots and stem-and-leaf tables rendered inside questions
  - Data Dragon boss battle — unlocks after ⭐3+ in all 4 activities
  - Boss pool: 15 mixed data questions (mode, range, line plots, stem-leaf)
  - Synced to `bryce-repo` and pushed to GitHub (`brianloriga/bryce`)

---

## [Web App] — Earlier

### Units Previously Added
- **15.1 & 15.2 — Measurement**: Number Lines, Right Tool, Read the Ruler, Unit Converter + Measurement Dragon boss
- **15.7 — Time**: Read the Clock, Elapsed Time, Time Converter, Time Problems + Time Titan boss
- **12.9 — Money**: Count the Money, Menu Math, Make Change, Money Problems + Money Monster boss
- **12.5 — Decimals**: 0.1 More/Less, Place Value, Decimal Problems, Complete the Table + Decimal Demon arcade boss
- **Reading — Unit 5**: Vocabulary, Comprehension, Text Features, Chronology + Reading Test boss
- **Science — Concept 4**: Constellations, Moon Phases, Day & Night, Space Vocabulary + Space Battle boss

---

_Format: `[Version/Phase] — Date` followed by Added / Changed / Fixed / Removed sections._
