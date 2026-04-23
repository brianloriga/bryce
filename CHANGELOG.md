# SnapStudy — Changelog

All notable changes to this project are tracked here.

---

## [Unreleased] — iOS App Development

### Interactive Measurement Tools — 2026-04-22

#### Added — `QuizScreen` (`src/screens/QuizScreen.js`)

- **`AngleStimulus` component** — procedurally draws two labeled rays from a vertex (e.g. L, M, N) for protractor questions. The angle is rendered from `geometry.angleDeg` so no external image is needed. Eliminates "shown above" with nothing to see.
- **`SegmentStimulus` component** — draws a colored bar over a ruler with tick marks and clearly visible number labels for ruler/length questions. Unit label (in / cm) displayed. Number labels are rendered as children of the outer canvas — not inside the ruler body — so they never clip on Android.
- **Protractor redesign — reference arm inside the protractor** — the drawn angle (white "pencil line") now lives *inside* the virtual protractor view, exactly like placing a real protractor on paper. Students read the degree scale where the white arm crosses rather than eyeballing two separate drawings. This makes distinguishing 45° from 60° tractable.
  - Tick marks added at every 10° (in addition to labeled marks at 0, 30, 45, 60, 90, 120, 135, 150, 180)
  - Vertex and ray-end labels (e.g. M, N, L) drawn at correct positions from `geometry`
  - Small dotted arc between 0° and the reference angle mirrors real protractor diagrams
- **Slider anti-freeze** — `panHandlers` moved from the small 24px handle to the entire track/ruler surface. On `onPanResponderGrant` the handle jumps to the touch position using `e.nativeEvent.locationX`, so tapping anywhere on the bar works instantly.
- **Gesture capture hardening** — added `onMoveShouldSetPanResponderCapture: () => true` (fires before `ScrollView` can claim the gesture) and `onPanResponderTerminationRequest: () => false` (prevents the OS from stealing the gesture mid-drag). Both protractor and ruler sliders updated.
- **Scroll lock during drag** — `scrollEnabled` state passed from `QuizScreen` to `ProtractorRenderer` / `RulerRenderer`; set to `false` on `onPanResponderGrant` and restored on `release`/`terminate` so the parent `ScrollView` never competes with a slider drag.
- **Unit-aware ruler** — `RulerRenderer` now reads `q.geometry?.unit` (`"inch"` or `"cm"`) and `q.geometry?.rulerMax` so the interactive ruler uses the same scale and unit as the stimulus bar above it. Readout and reveal label both show the correct unit abbreviation.
- **Worksheet hint** — "📖 Reference your worksheet" fallback only shown when both `image_url` and `geometry` are absent (legacy questions with no geometry data).
- **Button spacing** — `marginTop: 20` added above "Check Angle" and "Check Measurement" buttons.

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **Measurement tool prompt rewritten** — AI now emits a `geometry` object alongside every `measurementTool` question:
  - Angle: `{ "type": "angle", "angleDeg": 68, "vertex": "M", "ray1": "N", "ray2": "L" }`
  - Segment: `{ "type": "segment", "length": 3.5, "unit": "inch", "color": "blue", "rulerMax": 5 }`
- **"Shown above" banned** — prompt now explicitly forbids "shown above", "in the image", or "in the diagram" for all `measurementTool` questions (the app draws the shape; there is no separate image to reference).
- Example questions in the prompt updated to include geometry objects.

#### Changed — `aiService.js`

- `regenerateQuestion` mapper now forwards `measurementTool` and `rulerMaxCm` fields (was previously missing from the regen path).

---

### Question Quality & UX Hardening — 2026-04-22

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **`fill_in` restricted to math only** — fill-in-the-blank questions are now exclusively used for math and number calculations (decimals, fractions, currency, measurements). Science, reading, social studies, and vocabulary questions must use `multiple_choice`, `true_false`, or `word_bank` instead. Restriction stated in three places in the prompt to eliminate ambiguity.
- **`visual_mc` guardrails tightened** — all three conditions must now be met before `visual_mc` is allowed (emoji-representable answers, no worksheet text available, and visual representation genuinely helps). Explicit negative examples added: "What is the main idea?", "Which best describes how traits affect organisms?", and any question whose answer is a word or sentence are all banned from `visual_mc`. `CRITICAL` note added to the final user-content message.
- **`word_bank` unambiguous answer rule** — AI must now mentally test every word in the word bank against the blank before finalising. If more than one word produces a grammatically correct or factually defensible sentence, the sentence must be rewritten until only one word fits. Failing example added to the prompt ("Both humans and animals can \_\_\_ new behaviors" where learn/inherit/affect all work).
- **Visual aid questions auto-anchored to lesson topic** — visual aid questions are now explicitly instructed to use the scanned text pages as context and ask questions that connect the image to a concept from the lesson. Trivial identification questions ("what animal is shown", "what colour is this") are banned unless that is the lesson topic.

#### Changed — `ScanScreen` (`src/screens/ScanScreen.js`)

- **Visual Aid section description updated** — copy now explicitly mentions "map, labeled illustration, or any image your child needs to see to answer questions" so parents recognise it applies to book imagery, not just charts/graphs.
- **Visual Aid slot label updated** — empty slot now reads "Diagram, map, or picture (optional)" instead of the generic "Visual Aid (optional)".
- **"How it works" step added** — new step explains that Visual Aid photos appear directly in the quiz so the child never needs the physical book.
- **Caption field removed** — previously added caption input removed after feedback that parents don't know what the lesson is about at scan time; the AI now derives context automatically from the lesson text pages.
- **`generateAudio` removed** — audio generation call removed from `handleSave`; TTS pipeline no longer triggered after saving a lesson.

#### Changed — `QuizScreen` (`src/screens/QuizScreen.js`)

- **Audio playback fully removed** — `expo-av` import, `Audio.setAudioModeAsync`, `soundRef`, `unloadSound`, `toggleAudio`, `audioPlaying`/`audioLoading` state, the 🔈/🔊 speaker button, and audio button styles all removed. Audio was inconsistent and not well received.
- **Fill-in fuzzy answer matching** — two new matching layers added on top of the existing exact match, so young children are not penalised for minor typing issues:
  - *Starts-with word-boundary check*: if the typed answer begins with the correct answer followed by a space (e.g. "main entrance" when answer is "main"), it is accepted. Intentionally skipped for numeric answers so "0.35" never passes for "0.3".
  - *Levenshtein spelling tolerance*: answers ≤ 3 chars require exact match; 4–6 chars allow 1 edit; 7+ chars allow 2 edits. Numeric answers are excluded entirely.

---

### Parent Progress Dashboard (7.20) — 2026-04-20

#### Added — `ProgressScreen` (`src/screens/ProgressScreen.js`)

- New screen accessible from the Account tab via a **"View Progress"** button
- **Kid selector** — horizontal scrollable chip strip; if the family has more than one child, parent taps to switch between them (single-kid families see a name + avatar header instead)
- **3 stat cards** — Quizzes taken · Avg Score (colour-coded green/amber/red) · Stars earned (with perfect-3-star count)
- **Recent Activity feed** — last 10 quiz results showing lesson name, score/total, star rating, and a friendly "5m ago / 2d ago" timestamp
- **By Lesson table** — groups all attempts by lesson; shows attempt count, best score, best stars, and an animated colour-coded progress bar
- Pull-to-refresh, loading state, error state, and empty state (no quizzes yet)

#### Changed — `AccountScreen`
- Added a **"View Progress"** button card (green bar-chart icon) between the kid profiles section and the Subscription section — navigates to the new Progress screen

#### Changed — `App.js`
- `ProgressScreen` registered as a stack screen (`name="Progress"`)

---

### Self-Contained Questions + Context Reference Card — 2026-04-20

#### Added — ContextCard component (`src/screens/QuizScreen.js`)
- New `ContextCard` component renders a visual reference panel **above the question** when GPT includes a `context` field
- Supports two layouts:
  - **Grid** — 2-column icon grid; each item shows a vector icon (Ionicons), a label, and a value (e.g. "Cat · 10¢"); used for price tables, score lists, measurement sets
  - **Table** — multi-column data table with alternating row shading; used for comparisons with multiple columns
- Subject-colour accent bar on the left edge; icon circles tinted to match the current subject
- No emojis — all icons are clean Ionicons vector assets chosen by GPT from a predefined allowed list

#### Changed — `generate-questions` Edge Function
- **SELF-CONTAINED QUESTION RULE**: every question must now be answerable without the original worksheet — all data needed to answer must appear either in the question text itself or in a `context` reference card
- **CONTEXT RULES** added to SYSTEM_PROMPT: defines when to produce a `context` object, the grid/table schemas, and a curated list of ~40 allowed Ionicons names GPT may assign to items
- REGEN prompt updated to carry context through on regeneration

#### Changed — `aiService.js`
- Both `generateQuestionsFromImages` and `regenerateQuestion` mappers now forward the `context` field

---

### Rich Question Types — 2026-04-20

#### Added — New Question Types (AI + UI)

Five question types are now fully supported end-to-end: from AI generation → service mapping → quiz rendering → scan review editing.

**`fill_in` — Fill in the Blank**
- Student types a free-text answer; normalised string comparison against `correctAnswer` + `acceptedAnswers` array
- Interactive: shake animation + haptic on wrong, green highlight on correct; answer revealed on mistake
- Editable in ScanScreen: correct answer field + accepted variants (comma-separated)

**`ordering` — Put in Order**
- Student taps chips from a word/phrase pool to build the correct sequence in numbered slots
- Auto-checks when all slots filled; shows correct sequence on wrong answer
- Editable in ScanScreen: items list (one per line) + correct order by item number

**`true_false` — True or False**
- Large, full-width True / False buttons with green / red fill on reveal
- `correctAnswer` stored as a boolean
- Editable in ScanScreen: True / False toggle buttons

**`word_bank` — Word Bank**
- Tap a word chip to fill the `____` blank in a rendered sentence
- Sentence re-renders in real-time showing the selected word; shake + haptic on wrong answer
- Editable in ScanScreen: word bank (comma-separated) + correct answer field

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)
- `SYSTEM_PROMPT` fully rewritten with per-type JSON schemas and "VARIETY GUIDANCE" instructing GPT to use the best type for each question instead of defaulting to multiple choice
- `REGEN_SYSTEM_PROMPT` updated to match the original question type on regeneration
- `sanitizeQuestion` updated to pass through all new fields: `correctAnswer`, `acceptedAnswers`, `items`, `correctOrder`, `wordBank`

#### Changed — `aiService.js`
- `generateQuestionsFromImages` mapper handles all 6 question types with safe defaults
- `regenerateQuestion` mapper mirrors the same logic

#### Changed — QuizScreen (`src/screens/QuizScreen.js`)
- Subject-colour accent stripe at top of screen (tied to `unit.subject`)
- Question type badge on every question card (colour-tinted by subject)
- `FillInRenderer`, `OrderingRenderer`, `TrueFalseRenderer`, `WordBankRenderer` components added
- `GeometryDisplay` (pie, bar, shape) retained and improved
- Results screen shows star rating, score, and unit title

#### Changed — ScanScreen (`src/screens/ScanScreen.js`)
- Review step question cards now render type-specific editors for all 5 types
- Each card shows a colour-coded type badge (Fill in the Blank, Ordering, True / False, Word Bank, Multiple Choice)

---

### Subject Categories + HomeScreen Grid Redesign — 2026-04-20

#### Fixed — HomeScreen grid polish (follow-up)

- **Strict 2-column grid** — replaced `flexWrap` approach (which could produce uneven rows) with a `chunkPairs()` helper; tiles are now always rendered as explicit 2-per-row `View` rows with a transparent spacer when there is an odd number of subjects
- **Global search on landing page** — search bar now lives on the main subject grid screen (always visible when lessons exist); typing switches the entire view from subject tiles to a flat, cross-subject lesson list in real time; clearing the input returns to the tile grid; the search bar inside a drilled-in subject still scopes to that subject only
- **Rounded icon images** — each subject icon now sits inside a `tileIconWrapper` with `borderRadius: 18`, a soft semi-transparent white background, and `overflow: hidden` so the PNG asset is cleanly clipped to match the card's rounded corners
- **Hooks order fix** — moved all `useMemo` calls above the `if (loading)` and `if (loadError)` early returns to comply with React Rules of Hooks (was causing a "change in order of Hooks" console error)
- Removed stale `subjectHeaderEmoji` text node from drill-in header; replaced with a small rounded `Image` using the subject's PNG icon

---

#### Added — Subject System (`src/utils/subjects.js`)

- New `DEFAULT_SUBJECTS` constant: **Reading, Math, Science, Social Studies** — each has a stable DB key, display label, emoji, and tile colour
- `UNASSIGNED_SUBJECT` fallback for lessons with no subject set
- `buildSubjectList(units, customSubjects)` — merges defaults + any parent-created subject keys found in loaded lessons; custom keys sorted alphabetically after the defaults
- `resolveSubject(key, allSubjects)` — safely maps a DB key back to a full subject object with fallback

#### Changed — HomeScreen: Subject Grid Layout

- **Landing view** replaced flat colour-coded lesson list with a **2-column subject tile grid** (inspired by kid-friendly education app design)
- Each tile is a large rounded square showing the subject emoji, name, and lesson count badge
- Tapping a tile drills into that subject's lesson list with a back button + subject header
- Lessons are still displayed as full-width colour cards (same as before) once inside a subject
- Search bar still appears at 3+ lessons within a subject
- **Unassigned** bucket appears automatically for any lessons without a subject
- Empty-state tiles for unused default subjects replaced by a subtle hint prompt

#### Changed — ScanScreen: Subject Picker in Review Step

- Subject picker appears in the review/save step between the lesson title and questions
- Four default subject chips (Reading, Math, Science, Social Studies) with colour-coded borders; tap to select; selected chip fills with the subject colour
- **"Create your own"** chip expands a text input so parents can name a custom subject (e.g. "Spanish", "Art", "Health") — name is converted to a stable `snake_case` DB key on save
- If no subject is selected, lesson saves to "Unassigned" with a hint explaining this

#### Changed — `saveCustomUnit` in `supabase.js`

- Added `subject` parameter (5th arg, defaults to `'unassigned'`)
- Previously hardcoded `subject: 'custom'` replaced with the passed-in value

### Scan Flow UX, Reading Passage & Visual Aid Overhaul — 2026-04-19

#### Added — Reading Passage (📖 Read Along)

- GPT now detects and extracts reading passages from scanned pages — short stories, articles, poems, science texts — any content students need to reference to answer the questions
- `passage TEXT` column added to `custom_units` table (migration: `ALTER TABLE custom_units ADD COLUMN IF NOT EXISTS passage TEXT;`)
- `saveCustomUnit()` updated to accept and persist the optional passage
- **ScanScreen preview step** — shows a blue "📖 Reading Passage Detected" card when a passage was extracted, explaining that students will be able to open it during the quiz
- **QuizScreen** — full-width "📖 Read Along / Open the reading to help answer" bar appears below the A/B/C/D options when the unit has a passage; tapping opens a bottom-sheet modal with the full text in a scrollable view and a "Back to Quiz" button
- Works for any subject: reading comprehension, grammar (identify verbs/adjectives), science passages, short stories, etc.

#### Added — Multiple Visual Aid Photos per Lesson

- Visual aid section now supports **1, 2, or 3 photo slots** based on question count:
  - 5 or 9 questions → 1 slot
  - 15 questions → 2 slots
  - 20 questions → 3 slots
- Each filled slot shows a thumbnail plus a **"Questions from this image: [1] [2] [3]"** pill picker so the parent controls exactly how many questions to generate per diagram
- `visualImages` array replaces single `visualImage` state throughout ScanScreen
- `generate-questions` edge function updated to accept `visualImages: [{base64, questionCount}]`; uploads each to Supabase Storage; constructs per-image GPT instructions ("for Visual Aid 2, generate 1 question, mark with `image_ref: 2`"); returns `visual_urls` array
- `aiService.js` maps `q.image_ref` (1-based index) to the correct URL from `visual_urls`
- Backwards compatible: old `visualImage` single-image field still accepted

#### Added — Image Resize Before Upload (`expo-image-manipulator`)

- All captured images (page scans and visual aids) are now resized to **1024px wide, JPEG 70%** before base64 encoding using `expo-image-manipulator`
- Reduces per-image payload from 1–3MB to ~80–150KB, enabling 10-page lessons to safely fit within the Supabase Edge Function 6MB body limit
- Pickers changed to `quality: 1` (no double-compression); manipulator handles the single resize+compress pass

#### Added — Cancel Generation

- **Cancel button** on the generating screen — immediately returns to the pick screen with all photos and settings intact; if the edge function response arrives after cancellation it is silently discarded
- **"Cancel & Start Over"** link below the Generate button on the pick screen — confirmation alert ("This will remove all your photos and start fresh") prevents accidental reset

#### Changed — Scan Flow Order

- **Question count picker (5 / 9 / 15 / 20) now appears after the first photo is added**, not before — keeps the initial screen clean with just the camera/library hero buttons
- Picker appears at the top of the content once images exist, before visual aid slots and the generate button

#### Changed — Visual Aid Camera (iOS fix)

- Replaced Modal-based "Photo Tips" sheet with a native `Alert.alert` — eliminates the iOS view-controller conflict where `launchCameraAsync` silently hung when called immediately after a Modal dismissed
- Tips now include explicit crop instruction: "You'll get a crop tool after the photo — drag the corners to frame just the diagram"
- `allowsEditing: true` on both camera and library visual aid captures gives the native crop editor

#### Fixed — Profanity filter stripping question fields

- `sanitizeUnit` in `profanityFilter.js` was only keeping `question`, `options`, and `correctIndex` — silently dropping `image_url`, `hint`, `type`, `geometry`, and `audio_url` from every question
- Fixed with object spread (`...q`) so all fields are preserved; only text fields are sanitized

#### Fixed — JWT ES256 rejection on all edge functions

- Supabase's newer projects issue ES256 JWTs; the edge function gateway only accepted HS256, blocking every request before the function ran
- All three edge functions (`generate-questions`, `generate-audio`, `detect-crop`) redeployed with `--no-verify-jwt`
- Better error surfacing in `aiService.js`: `error.context` is now read as a `Response` object with `await ctx.json()` so real error messages appear instead of the generic "Edge Function returned a non-2xx status code"

#### Added — `detect-crop` edge function (experimental, replaced by native crop)

- Built and deployed a `detect-crop` edge function using GPT-4o-mini (`detail: high`) to return a content bounding box as percentages; `expo-image-manipulator` applied the crop
- Replaced with native `allowsEditing: true` after GPT's coordinate estimates proved too imprecise for consistent results; function remains deployed but is no longer called

### Visual Aid Scan Step — 2026-04-19

#### Added — Optional visual aid capture in ScanScreen

- New "Visual Aid (optional)" section appears below the page thumbnail strip once at least one page is added
- Parent can photograph any diagram, graph, or image from the book before generating questions
- **Photo Tips modal** shown before camera opens:
  - Flash ON eliminates phone shadow on page
  - Fill the frame with just the image
  - Hold phone directly above page — no angle
  - Good natural light also works
- Visual aid captured at `quality: 1.0` (vs. 0.8 for text pages — detail matters more for images)
- After capture: thumbnail preview with Retake and Remove options
- Generating screen shows "Including your visual aid." when a visual is present

#### Changed — generate-questions edge function

- Accepts optional `visualImage` base64 string alongside `images`
- When present: uploads the visual to new `lesson-visuals` Supabase Storage bucket (public) using service role key
- Appends visual as the final image in the GPT call with explicit instructions:
  - Generate `imageVisualCount(n)` questions specifically about the diagram (same 1/2/3/4 ratio)
  - Questions reference "the image shown" / "the diagram above"
  - Those questions marked with `image_ref: true`
  - Remaining questions generated from text pages as normal
- Returns `visual_url` alongside questions in the response
- `sanitizeQuestion` updated to pass through `image_ref` flag

#### Changed — aiService.js

- `generateQuestionsFromImage(base64Images, questionCount, visualBase64 = null)` — new third param
- Passes `visualImage` in request body when provided
- Maps `visual_url` onto questions where `image_ref === true` → becomes `image_url` on the question object

#### Changed — QuizScreen

- Renders a `<Image>` (180px tall, full card width, rounded) above question text when `q.image_url` is present
- Works alongside the audio button, geometry display, and markdown text

#### Setup — run once in Supabase SQL Editor

```sql
insert into storage.buckets (id, name, public)
values ('lesson-visuals', 'lesson-visuals', true)
on conflict (id) do nothing;
```

### AI Read-Aloud (OpenAI TTS + Supabase Storage) — 2026-04-19

#### Replaced expo-speech with cached OpenAI TTS

- Removed `expo-speech` (robotic, question-only) and replaced with a full OpenAI TTS pipeline
- **Voice:** `nova` model via `tts-1` — natural-sounding, child-friendly

#### Added — `generate-audio` Supabase Edge Function

- New function at `supabase/functions/generate-audio/index.ts`
- Receives `unit_id` + `questions` array; generates one MP3 per question in parallel
- Speech text reads the full question then each answer: "Question text. A: option. B: option. C: option. D: option."
- Strips emoji, markdown (`**bold**`, `` `code` ``), and block-drawing characters before sending to TTS so audio reads cleanly
- Uploads each MP3 to Supabase Storage bucket `question-audio` (public)
- Patches the `custom_units` row directly (via service role key) — adds `audio_url` to every question object
- Deploy: `npx supabase functions deploy generate-audio --project-ref vwyhxnaunkbrxuzjxpzt --no-verify-jwt`
- Storage bucket setup (run once in Supabase SQL Editor):
  ```sql
  insert into storage.buckets (id, name, public) values ('question-audio', 'question-audio', true)
  on conflict (id) do nothing;
  ```

#### Added — `generateAudio()` in aiService.js

- Calls the `generate-audio` edge function
- Fired fire-and-forget from `ScanScreen.handleSave` after `saveCustomUnit` returns — never blocks the save UX

#### Changed — ScanScreen `handleSave`

- Captures the saved unit row (which includes the DB-assigned `id`)
- Immediately shows the success screen, then kicks off `generateAudio(saved.id, questions)` in the background

#### Added — Audio playback in QuizScreen

- Installed `expo-av` for native audio streaming
- 🔈 speaker button appears in the question card header **only when `audio_url` is present** on that question
- Tapping plays the cached MP3 from Supabase Storage via `Audio.Sound.createAsync`
- Tap again (🔊) to stop; ⏳ shown while loading
- Audio stops automatically when the question is answered, the user navigates, or the component unmounts
- `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` ensures playback works when the device is in silent mode
- Lessons saved before this update will not show the button (no `audio_url` on their questions) — no breakage

### Rich Visual Questions, Hints, TTS & SVG Geometry — 2026-04-17

#### Added — Visual question generation
- Edge function updated: GPT-4o now freely composes visual aids **directly in the question text** using emoji, unicode symbols, and creative formatting — no predefined visual types
- `visualCount(n)` helper scales the number of visual questions: 5q→1, 9q→2, 15q→3, 20q→4
- Visual questions marked with `"type": "visual_mc"` so the app gives them a larger display card
- `max_tokens` bumped from 2000 → 4000 to support richer JSON output

#### Added — Hint system
- Every question now includes a `"hint"` field generated by GPT — one encouraging sentence that nudges without giving away the answer
- 💡 **Show hint** button below each question card in QuizScreen; tapping reveals a soft amber card with an animated fade-in
- Hint collapses automatically when advancing to the next question

#### Added — Read-aloud (TTS)
- 🔈 button in the top-right of every question card; tapping reads the question text aloud using `expo-speech`
- Tap again to stop; icon becomes 🔊 while speaking
- Speech stops automatically when the player answers or navigates away

#### Added — Markdown rendering
- Question text now renders through `react-native-markdown-display` — supports **bold**, `code`, line breaks, and simple tables
- Custom dark-theme markdown styles match the existing quiz card design
- Visual questions get a slightly larger font (22px / line-height 36) for emoji-heavy content

#### Added — SVG geometry display
- Math questions can include an optional `"geometry"` object describing a shape to render
- Three supported types: `pie` (arc segments), `bar` (bar chart), `shape` (circle / rectangle / triangle)
- Rendered with `react-native-svg` above the question text; unknown types silently skipped
- `GeometryDisplay` component lives inside QuizScreen

#### Added — Per-question regenerate
- 🔄 icon button on every question card in the ScanScreen review step
- Tapping calls the edge function in `regenerate` mode: sends original images + question text → returns one replacement question
- Shows a spinner on that card only; other questions remain interactive
- Regenerate does not count against the daily scan rate limit
- `regenerateQuestion()` added to `aiService.js`

#### Changed — Packages
- `expo-speech` installed (TTS)
- `@ronradtke/react-native-markdown-display` installed (markdown in questions — maintained fork that fixes `prop-types/factoryWithThrowingShims` crash on RN 0.72+)

#### Fixed — `prop-types/factoryWithThrowingShims` crash on app launch
- `react-native-markdown-display` has a broken dependency on an old `prop-types` internal that was removed in React Native 0.72+
- Replaced with `@ronradtke/react-native-markdown-display` (actively maintained fork with the fix); updated import in `QuizScreen.js`

#### Fixed — `react-native-svg` module resolution crash (`./lib/extract/types`)
- The version of `react-native-svg` installed via `npx expo install` had an internal path restructuring incompatible with this project's Metro setup
- Removed `react-native-svg` entirely; rewrote `GeometryDisplay` using pure React Native `View` and `Text` elements:
  - `pie` → proportional horizontal strip segments with a colour legend
  - `bar` → View-based bars with value labels
  - `shape` → styled `View` with `borderRadius` for circles, rectangles, and basic shapes
- Zero extra dependencies; visually equivalent output

#### Fixed — Edge function TypeScript red errors in IDE
- Added `// @ts-nocheck` to `generate-questions/index.ts` — the Deno runtime globals (`Deno`, `https://` imports) are not known to the Node type checker; this suppresses false positives without affecting deployment

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
