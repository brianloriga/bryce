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

### Bug Fixes Batch — 2026-04-17

#### Fixed
- **3.11** Auto-remove rejected images — when GPT-4o content validation rejects an image, the staging array is now cleared automatically so the parent can immediately add different images without manually removing them
- **7.1** QuizScreen zero-question guard — units with no questions now show a friendly "No questions yet" screen instead of crashing with a divide-by-zero error
- **7.2** QuizScreen `setTimeout` cleanup — the 1.4 s auto-advance timeout is now stored in a ref and cancelled on component unmount, preventing ghost state updates if the user navigates away mid-quiz
- **7.3** QuizScreen `correctIndex` clamping — `safeCorrectIndex` clamps the stored value to the valid option range so an out-of-bounds value can never silently mark the wrong answer correct
- **7.4** Replaced hardcoded "Bryce" in ScanScreen success screen and how-it-works steps with `activeKid?.name ?? 'Your child'` so it works for any family
- **7.5** Parent PIN cleared on sign-out — `clearParentPin()` is now called before `signOut()` so a PIN set by one account can't carry over to another account on the same device
- **7.6** Renamed AsyncStorage key from `@brycelearning_parent_pin` → `@snapstudy_parent_pin` for brand consistency

---

### Phase 7 — Security, Polish & Engagement — 2026-04-17

#### Security (7.B)
- **7.7** Edge Function rate limiting — max 20 scans/day per user; JWT user ID extracted server-side, daily count checked against new `scan_logs` table in Supabase; returns HTTP 429 with a clear message if exceeded
- **7.8** PIN storage upgraded from AsyncStorage → `expo-secure-store` — PIN is now encrypted at rest on-device (important on Android)
- **7.11** Removed all `console.log` statements that exposed user IDs, Supabase keys, and debug info from `supabase.js` and `AuthContext.js`

#### UX & Polish (7.C)
- **7.12** HomeScreen error state — network failures now show a friendly "Couldn't load units" screen with a **Try Again** button instead of a silent blank screen
- **7.13** KidSelectScreen error state — profile load failures now surface with a **Try Again** button; `kidLoadError` exposed from `AuthContext`
- **7.15** Upgrade button in AccountScreen now shows a beta alert: "All features are free during testing — subscriptions unlock at public launch"
- **7.17** Search / filter bar on HomeScreen — appears automatically when a parent has 3+ units; filters by title in real-time; empty state adapts to show "No matches" with a clear-search button

#### Engagement (7.D)
- **7.19** Quiz results saved to Supabase — every completed quiz writes score, total, stars, kid ID, unit ID, and timestamp to a new `quiz_results` table (fire-and-forget, never blocks the results screen)

#### Schema additions (run in Supabase SQL Editor)
- `quiz_results` table — tracks per-kid quiz history for future progress dashboard
- `scan_logs` table — powers daily scan rate limiting in the Edge Function

---

### Phase 5 — Polish & COPPA Compliance — 2026-04-17

#### Added
- **OnboardingScreen** — 3-slide animated intro shown once to new parents after first login:
  - Slide 1 (green): "Scan any textbook" — explains the core camera feature
  - Slide 2 (purple): "One account, every kid" — explains multi-profile support
  - Slide 3 (blue): "Watch them shine" — explains quiz progress and stars
  - Animated pill dots indicate current slide; accent color shifts per slide
  - Skip button + Next/Let's Go button; completion stored in AsyncStorage (`@snapstudy_onboarding_done`)
- **PrivacyPolicyScreen** — full COPPA-compliant privacy policy covering data collection, children's privacy, OpenAI image processing disclosure, and data deletion rights
- **TermsScreen** — Terms of Service covering parental consent requirement, content upload rules, subscription terms, and educational disclaimer
- **Parental consent checkbox** on AuthScreen signup — "I confirm I am a parent or guardian (18+)" must be checked before account creation; blocks submit with a clear error if unchecked
- **Haptic feedback** in QuizScreen — `expo-haptics` success vibration on correct answers, error vibration on wrong answers
- Wired **Privacy Policy** and **Terms of Service** rows in AccountScreen About section — now navigate to the real screens

#### Dependencies added
- `expo-haptics`

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

### UX & Polish — 2026-04-17 (continued)

#### Changed — "Unit" renamed to "Lesson" throughout UI
- All user-facing text updated across ScanScreen, HomeScreen, QuizScreen, and AccountScreen:
  - "Scan a Unit" → "Scan a Lesson", "Unit title" → "Lesson title", "Save Unit" → "Save Lesson"
  - "Scan another unit" → "Scan another lesson"; alert messages, How It Works modal updated
  - HomeScreen: greeting subtitle, search placeholder, empty state, delete confirmation, hint text
  - QuizScreen: "Back to Units" → "Back to Lessons", empty state message
  - AccountScreen: subscription card description
- Internal variable/function names unchanged (`unit`, `units`, `unitTitle`, etc.)

#### Added — "Go to Learn" button on save success screen (ScanScreen)
- After saving a lesson, a second outlined button appears below the green "Scan another lesson" button
- Tapping it calls `navigation.reset` to navigate directly to the Learn tab
- HomeScreen `useFocusEffect` automatically refreshes the lesson list on arrival

#### Fixed — Keyboard covers edit modal and question editor
- Added `KeyboardAvoidingView` (`behavior="padding"` on iOS, `behavior="height"` on Android) to the Edit Profile modal in KidSelectScreen — sheet now slides up when the keyboard opens
- Same fix applied to the ScanScreen question review/edit step — keyboard no longer buries text inputs

#### Fixed — ScanScreen crash on photo capture
- `Image` component accidentally removed from ScanScreen imports during avatar cleanup; restored — photo thumbnails now display correctly after taking or selecting a picture

#### Changed — Avatar system replaced with colour + initial
- `src/utils/avatars.js` replaced: now exports a 12-colour `COLOR_PALETTE`, `DEFAULT_COLOR`, and `getAvatarColor(key)` with legacy fallback (any non-hex value falls back to default colour)
- `src/components/KidAvatar.js` — new reusable component; renders a rounded-square tile with the child's first initial in large bold white on a solid colour background; accepts `name`, `color`, `size`, and `radius` props
- **KidSelectScreen** — image picker replaced with a 12-swatch **colour picker grid**; selected swatch shows a white ring + checkmark; add/edit forms show a live preview (initial + colour) as the parent types the name or selects a colour; kid bubbles show `KidAvatar`
- **HomeScreen** — large 88px `KidAvatar` above the greeting replaces the image avatar
- **AccountScreen** — profile card (56px) and kid list rows (40px) both use `KidAvatar`
- All `Image` imports for avatar display removed from HomeScreen and AccountScreen
- DB `avatar` field now stores a hex colour string (e.g. `#6366f1`); legacy emoji/image keys handled gracefully

---

### Phase 7 — Theme System, Avatar Overhaul & Profile Editing — 2026-04-17

#### Added — Dark / Light Mode

- **ThemeContext** (`src/context/ThemeContext.js`) — global theme provider with full `dark` and `light` color palettes; preference persisted in AsyncStorage (`@snapstudy_theme`); `useTheme()` hook exposes `{ theme, toggleTheme, isDark }` to every screen
- **Appearance section in AccountScreen** — sun/moon icon + `Switch` toggle lets the user flip between Dark and Light mode live; preference survives restarts
- **Themed tab bar** in `App.js` — background, active/inactive tint, and border all adapt to the active theme

#### Changed — Screen Theming

- **HomeScreen** — fully themed via `createStyles(theme)` + `useMemo`; background, cards, search bar, empty state, error state, badges, and activity indicator all respect theme
- **AccountScreen** — fully themed; PIN pad keys, banners, profile card, kid list, subscription card, and About rows all use theme tokens; Sign Out button uses solid danger red with white text in dark mode for legibility; Manage Profiles button gets accent-tinted background + white text in dark mode
- **ScanScreen** — fully themed; all previously hardcoded dark colors (`#0d0d1a`, `#1a1a2e`, `rgba(255,255,255,...)`) replaced with theme tokens; hero buttons, thumbnail strip, picker, modal sheet, and preview/edit cards all adapt; thumbnail overlay colours intentionally stay black (overlaid on photos)
- All `StatusBar style="light"` instances replaced with `style={theme.statusBar}` so status bar text is readable in both modes

#### Added — PIN Removal

- **Remove PIN lock** button — appears in AccountScreen below the green PIN banner whenever a PIN is set; taps trigger a confirmation alert then call `clearParentPin()` and update state immediately without requiring sign-out

#### Added — Custom Avatar Images

- **`src/utils/avatars.js`** — shared registry mapping 11 character keys (`bear`, `bunny`, `dino`, `dog`, `kitty`, `mermaid`, `owl`, `panda`, `red_dino`, `robot`, `unicorn`) to PNG assets in `child_icons/`; exports `getAvatarSource(key)`, `getAvatarBg(key)`, `AVATAR_KEYS`, `DEFAULT_AVATAR`
- All emoji-based avatar references replaced with real illustrated character images from `bryce-app/child_icons/`

#### Changed — Avatar Display

- **KidSelectScreen** — avatar picker grid now shows the illustrated character images (60×60 rounded square); kid bubbles on the "Who's learning today?" screen show the character image (90×90 rounded square); bubble shape changed from circle to `borderRadius: 22` to match image art style
- **HomeScreen** — kid badge (emoji + name) replaced with a large **88×88 rounded-square avatar image** above the greeting; only name and unit count shown below — cleaner and more prominent
- **AccountScreen** — profile card and kid list rows both display the character image instead of emoji; all avatar containers use rounded-square borders matching the image art style
- Avatar containers across all screens changed from circles to **rounded squares** (`borderRadius: 22/14/10`) to eliminate the "square image inside circle" layering artefact

#### Added — Edit Kid Profile

- **`updateKidProfile(kidId, { name, avatar })`** added to `supabase.js` — updates `kid_profiles` row via Supabase `.update()`
- **Edit profile modal in KidSelectScreen** — in "Manage Profiles" mode, each kid bubble now shows a purple pencil badge; tapping the bubble opens a bottom-sheet modal with:
  - Live avatar preview + name text input (pre-filled with current values)
  - Full avatar picker grid to choose a new character
  - "Save Changes" button calls `updateKidProfile` then reloads profiles

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
