# SnapStudy — Changelog

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
- Phase 3: Camera + GPT-4o Vision for AI question generation ✅ (see below)

---

### Phase 3: Camera + AI Question Generation — 2026-04-16

#### Added
- `bryce-app/src/screens/ScanScreen.js` — full photo-to-questions flow:
  - Take photo with camera or pick from library
  - Image preview before generating
  - Loading state while AI processes
  - Question preview with inline editor (edit text, options, swap correct answer, remove questions)
  - Save to Supabase or discard
  - Gate for non-logged-in users (prompts to sign in)
  - Success screen after saving
- `bryce-app/supabase/functions/generate-questions/index.ts` — Supabase Edge Function:
  - Receives base64 image from the app
  - Calls GPT-4o Vision with a 4th-grade teacher prompt
  - Returns `{ title, questions: [{ question, options, correctIndex }] }`
  - OpenAI key stored as a server secret, never exposed to client
- `bryce-app/src/services/aiService.js` — client wrapper for the edge function
- Added `saveCustomUnit()`, `getCustomUnits()`, `deleteCustomUnit()` to `supabase.js`

#### To activate
1. Get OpenAI API key at platform.openai.com
2. `npm install -g supabase`
3. `supabase functions deploy generate-questions --project-ref vwyhxnaunkbrxuzjxpzt`
4. `supabase secrets set OPENAI_API_KEY=sk-... --project-ref vwyhxnaunkbrxuzjxpzt`

#### Bug Fixes (same session)
- Fixed duplicate `KidSelect` screen name crash in Stack navigator
- Replaced `sb_publishable_` Supabase key with legacy `eyJ...` anon key (required for PostgREST/database access)
- Fixed `createKidProfile` and `saveCustomUnit` missing `parent_id` in INSERT — caused 403 Forbidden from RLS policy
- Added inline error/success messages to AuthScreen (replaced unreliable `Alert.alert` on web)
- Added web platform fallback to GameScreen (WebView not supported in browser)
- Fixed Metro bundler cache issues causing stale code to be served

#### Current State (end of session 2026-04-16)
- ✅ Account creation works (email + password)
- ✅ Email confirmation disabled for dev (re-enable before App Store)
- ✅ Sign in works
- ✅ Kid profile creation works (saved to Supabase)
- ✅ Kid select screen works — tapping a kid navigates to the main app
- ✅ App runs in browser via `http://192.168.40.183:8081`
- ⚠️  Expo Go / native not yet tested end-to-end (WebView won't work in browser)
- ⚠️  UI flagged for redesign (Phase 5)
- ⏳ Phase 3 AI scanning not yet tested (needs OpenAI key deployed to Supabase Edge Function)

#### Next Steps
- Phase 4: Subscriptions via RevenueCat / Apple In-App Purchase
- Or: Deploy Edge Function + test AI scanning (needs OpenAI API key)

---

### UI Polish + PIN Protection + Bubbly KidSelect — 2026-04-17

#### Added
- **Parent PIN lock** on Account tab:
  - Kids cannot access subscriptions, sign-out, or profile management without PIN
  - First visit prompts parent to set a 4-digit PIN
  - PIN required on every Account tab focus (re-locks when switching tabs)
  - Wrong PIN triggers shake animation; "I forgot my PIN" option via sign-out reset
  - "Lock" button in Account header to manually re-lock at any time
- **Bubbly animated KidSelectScreen** redesign:
  - Soft lavender background (`#f5f3ff`) with 7 floating animated background circles
  - Large 90px circular profile bubbles with color-matched backgrounds per avatar
  - Spring bounce animation on each profile tap before navigating
  - Content fades and slides up on screen load
  - "Who's learning today? 🎓 / Tap your picture to start!" welcoming text
- **Manage mode for KidSelectScreen**: navigating from Account passes `mode: 'manage'` — selecting a kid in manage mode updates the active kid without resetting navigation back to Learn tab; "Done" button returns to Account
- Renamed **Play → Learn** tab with `school` Ionicons icon

#### Fixed
- "Manage Kids Profiles" in Account was navigating to Play/Learn tab instead of the profile manager — fixed by passing `{ mode: 'manage' }` param and correcting the navigation target

### Phase 3 Follow-up + Bug Fixes — 2026-04-17

#### Added
- Multi-page scanning: parents can now add up to 6 pages per unit before generating
  - Horizontal thumbnail strip with page number badges and individual remove (✕) buttons
  - Dashed "+ Add page" tile at end of strip
  - Generate button shows page count: "⚡ Generate Questions from 3 pages"
  - GPT-4o receives all images in one request and spreads 9 questions across all pages
- Image content validation guardrail:
  - GPT-4o evaluates the image(s) before generating questions (same API call, no extra cost)
  - If the image is not educational content (face, animal, house, etc.) it returns `valid: false` with a plain-English reason
  - App shows a dismissible red inline error card with the AI's reason — no generic alert
- Deployed `generate-questions` Supabase Edge Function (project `vwyhxnaunkbrxuzjxpzt`)
- Set `OPENAI_API_KEY` as a Supabase secret (server-side only, never exposed to client)

#### Fixed
- **KidSelectScreen navigation bug**: tapping a kid called `selectKid` successfully but the app stayed stuck on the kid select screen. Fixed by adding a `useEffect` that watches `activeKid` and calls `navigation.reset` to Main once a kid is set — guarantees navigation fires after React re-renders with the new state.

#### Changed
- Redesigned `KidSelectScreen` with larger, more minimal UI:
  - Kid cards are now taller with a 64px colored avatar circle and 24px name text
  - "Add a Child" replaced with a clean dashed card (no small icons)
  - Added "Account" button in top-right header so parents are never stuck
  - Removed cluttered subtitle; added a subtle "Hold a profile to delete it" hint at the bottom
  - Avatar picker uses colored background circles matching each emoji

#### Added (continued — same session)
- **HomeScreen** — replaces WebView game; shows parent's custom scanned units as large colored cards:
  - Vibrant full-width cards with unit title, question count, and play button
  - Pull-to-refresh to pick up newly saved scans instantly
  - Long-press a card to delete a unit
  - Empty state with guidance to use the Scan tab
- **QuizScreen** — native multiple-choice quiz for any custom unit:
  - Dark themed; animated progress bar fills as questions are answered
  - A/B/C/D answer buttons; correct answer goes green, wrong goes red after each tap
  - Auto-advances after 1.4 seconds
  - Results screen with ⭐ rating (3 stars ≥89%, 2 stars ≥67%, 1 star ≥45%), score, Play Again / Back buttons
- **Tab bar redesign** — fully replaced:
  - Dark navy background (`#0f172a`) with no top border
  - Real `Ionicons` vector icons (game-controller, camera, person-circle) with filled/outline active states
  - Bright blue active tint, muted white for inactive — no more emoji icons
- Prompted camera vs library choice when tapping the empty placeholder or "+ Add page" tile in ScanScreen
- Improved Edge Function error handling: `aiService.js` now extracts the actual error body from `error.context` so real failure reasons are shown instead of generic "non-2xx" message
- Redeployed `generate-questions` Edge Function with `--no-verify-jwt` to fix "non-2xx status code" error caused by JWT gateway rejection

#### Fixed
- Edge Function returning non-2xx — was being blocked by Supabase JWT verification layer before the function even ran; fixed with `--no-verify-jwt` deploy flag

---

### UI Polish + Branding — 2026-04-17 (continued)

#### Added
- **WelcomeScreen** — new landing screen shown to unauthenticated users:
  - App icon, "SnapStudy" name, "Sign In" and "Create Account" buttons
  - Floating animated bubble background (green/purple palette)
  - Auth navigator (Welcome → Auth) conditionally replaces the main navigator when logged out
- **AuthScreen** redesigned — dark theme matching WelcomeScreen; app icon displayed; green submit button; purple toggle link
- **App renamed to SnapStudy** — updated everywhere: `app.json` name/slug/bundleID/package, `package.json`, all screen text
- **Green/purple color scheme** applied globally: tab bar active tint → green (`#4ade80`), loading spinner → green, AuthScreen accents → green/purple

#### Noted (pending implementation)
- When an image fails content validation (non-educational content detected by AI), the rejected image(s) should be **automatically removed** from the staging array rather than leaving them highlighted with an error — tracked in Roadmap `3.11`
- Boss battle + mini-game reward system planned — kids unlock a boss battle or mini-game after finishing a quiz with 2+ stars; parents choose the reward game per unit; individual games purchasable à la carte — tracked in Roadmap Phase 8

---

#### Current State (end of session 2026-04-17)
- ✅ Expo Go accessible via QR code (iOS Camera app → opens in Expo Go)
- ✅ Kid select → main app navigation works
- ✅ Edge Function deployed with OpenAI key; JWT issue resolved
- ✅ HomeScreen shows custom units; QuizScreen plays questions
- ✅ Modern dark tab bar with vector icons
- ⏳ AI scanning end-to-end test pending (needs physical camera on device)
- ⏳ Phase 4 Subscriptions not started

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
