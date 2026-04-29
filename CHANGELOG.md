# SnapStudy — Changelog

All notable changes to this project are tracked here.

---

## [Unreleased] — iOS App Development

### S1 Classification Sort — Enhanced Tool — 2026-04-29

First Science/Reading/Social Studies enhanced tool. Covers any sorting or categorizing worksheet question across all subjects and grades 2–6.

#### `ClassificationSortRenderer.js` (new — Tool S1)
- New `measurementTool: "classification_sort"` renderer — two modes: `two_way` (2 buckets) and `three_way` (3 buckets)
- Tap-tap interaction: tap a chip from the bank to select it (highlights + columns show "Tap to place ↓"), then tap a column to place it
- Tap a placed chip (shows ✕) to return it to the bank; tap the same chip again to deselect
- On Check: wrong placements shake (`Animated.sequence` spring) and return to the bank automatically after 900ms; student retries with only incorrect chips
- Category column headers use color-coded top-border accents (green / blue / orange) matching the chip color when placed
- Live step hint above columns updates as student progresses ("tap a card → tap a category → all placed → check")
- `selfContained: true` — renderer draws the entire interactive UI; no external image assets
- Fallback: `ordering` (two-way) or `multiple_choice` per item

#### AI Wiring
- `prompts.ts`: section 9 added with `two_way` and `three_way` schemas, field rules, trigger examples (living/non-living, solid/liquid/gas, legislative/executive/judicial, etc.), and tool added to the supported-tools list in the VISUAL INTERACTION FALLBACK RULE; regen entry added to `REGEN_SYSTEM_PROMPT`
- `index.ts`: regen context handler added for `classification_sort` — preserves mode and category concept, generates fresh items
- `ScanScreen.js`: `sortMode` added to `questionContext` for regen
- `QuizScreen.js`: import, `typeLabel` badge ("Sort It Out" / "Sort · 3 Categories"), and dispatcher added

#### `sampleQuestions.js`
- `classSort_twoWay`: 3 questions — Living/Non-Living (Science), Noun/Verb (ELA), Needs/Wants (Social Studies)
- `classSort_threeWay`: 2 questions — States of Matter (Science), Branches of Government (Social Studies)
- Added "Classification Sort (Enhanced)" group to `SAMPLE_GROUPS`

---

### Coordinate Grid — Cognitive Depth Upgrade — 2026-04-29

A second pass over the Coordinate Grid tool focusing on **cognitive depth** and **misconception correction**. The original `read` mode was MC-based, which allowed students to avoid true axis-reading. The new interaction modes force axis-first thinking and catch the most common coordinate mistake (x/y order swap).

#### `CoordinateGridRenderer.js` — Mode Upgrades

**`read` mode — x/y steppers (replaces MC)**
- Removed `options` / `correctIndex` from `read` mode entirely; student now uses two `+/−` number steppers — one for x, one for y — to enter coordinates
- `StepperRow` component: label + value display + decrement/increment `TouchableOpacity` buttons; range capped at ±grid range
- `XYSteppers` composite: two `StepperRow`s plus a "Check Answer" button; reads `pts[0].x` / `pts[0].y` as the correct answer
- Correct `answer` check: both x and y must match exactly; wrong-answer feedback names which axis(es) were off
- Educationally: forces x-before-y sequencing with haptic confirmation; eliminates MC guessing

**`error_detect` mode (new — 6th mode)**
- A pre-placed point is shown on the grid alongside a **character claim card** — avatar portrait (sam/nina/leo/ava/max/mia), character name, and their claimed coordinates in large colored text
- **Step 1 — Judge the claim:** two buttons, "✓ [Name] is right" and "✗ [Name] is wrong"
  - If right when right: banner "Correct! [Name] read it perfectly." ends interaction
  - If wrong when wrong (correct catch): amber claim card turns red with `✗` badge, then a 1-second "You caught it! 🎯" celebration banner animates in before Step 2
  - If wrong when right (incorrect): "Actually, [Name] was right!" feedback shown
- **Step 2 — Correct the coordinates:** same `XYSteppers` control fades in with a smooth slide-up animation (`Animated.timing`); student enters the actual coordinates to complete
- `AVATAR_IMG` registry maps the 6 character names to their PNG paths in `assets/child-avatars/`
- `QuizScreen.js` updated: `typeLabel` for `error_detect` mode shows "Coordinate Grid · Error Detection"
- Prompts (`prompts.ts`): `error_detect` mode added to the AI schema with instructions to always swap x/y for the claim and set `correctAnswer: "wrong"`; REGEN rules added for `error_detect`

**`plot` and `missing` modes — floating coordinate label**
- `GridSvgContent` accepts a `showCoordLabel` prop; when the ghost point is active and `showCoordLabel` is true, an SVG `Rect` + `SvgText` floating label renders `x: N  y: N` next to the dragged point
- Label positioned dynamically (right / left flip at grid boundary) to stay visible
- Label hides immediately on submit so it does not leak the answer after the check

**`missing` mode — shape/pattern framing (prompts + sample data)**
- AI prompt updated in `prompts.ts`: `missing` mode description now explicitly requires a **shape or pattern** context (e.g. "3 corners of a rectangle, student plots the 4th corner D"); plain "place a point" scenarios are disallowed for `missing` mode to prevent it from being pedagogically identical to `plot`
- `sampleQuestions.js` updated to reflect the stronger framing

#### `sampleQuestions.js` — New Test Cases
- `coordGrid_read`: `options` / `correctIndex` removed; `correctAnswer` updated to `"x,y"` format
- `coordGrid_errorDetect` (new set — 2 questions):
  - Q1: Sam claims `(5,2)` for a point actually at `(2,5)` — wrong claim, forces Step 2
  - Q2: Leo claims `(3,−2)` for a point actually at `(3,−2)` — correct claim, resolves at Step 1
- Both added to "Coordinate Grid (Enhanced)" group in `SAMPLE_GROUPS`

#### Styles added (`CoordinateGridRenderer.js` StyleSheet)
`readPrompt`, `stepperContainer`, `stepperRow`, `stepperLabel`, `stepperBtn`, `stepperBtnText`, `stepperValueBox`, `stepperValue`, `errCharCard`, `errCharCardWrong`, `errAvatar`, `errCharName`, `errCharSays`, `errCharCoord`, `errCharCoordWrong`, `caughtBanner`, `caughtBannerText`, `caughtBannerSub`

---

### Coordinate Grid — Initial Build — 2026-04-29

#### `CoordinateGridRenderer.js` (new — Tool #6)
- New `measurementTool: "coordinate_grid"` renderer — 5 initial interaction modes
- SVG-based grid drawn with `react-native-svg`; grid lines, axis lines, tick marks, and numeric labels all rendered in code (no image assets)
- Subtle quadrant tinting (I: teal, II: amber, III: red, IV: blue) helps students build quadrant mental models
- Points snap to nearest integer intersection via `PanResponder` + coordinate transform helpers; no free dragging
- Submit button required for all placement modes — no auto-advance on snap
- Haptic feedback on snap (`Expo.Haptics`) and on correct/wrong check

**`plot` mode** — student drags a point to the given target coordinate; submit validates

**`read` mode** (initial) — pre-placed point; 4 MC buttons; *(upgraded to steppers in next pass)*

**`multi_plot` mode** — active point label cycles through targets (A → B → C); each placed point freezes in its color; submit validates all at once

**`missing` mode** — shown points (A, B, C) rendered as static labeled dots; student plots missing point D

**`quadrant` mode** — pre-placed point; 4 MC buttons (Quadrant I/II/III/IV)

#### AI Wiring
- `prompts.ts`: `coordinate_grid` section added with all 5 mode schemas, field rules, and example JSONs; `MEASUREMENT TOOL REGEN RULES` section updated for all 5 modes
- `index.ts`: regen branch added for `coordinate_grid` with `coordinateGridMode` context routing
- `ScanScreen.js`: `coordinateGridMode` added to `questionContext` for regen

#### `sampleQuestions.js`
- Added `coordGrid_plot`, `coordGrid_read`, `coordGrid_multiPlot`, `coordGrid_missing`, `coordGrid_quadrant` question sets
- Added "Coordinate Grid (Enhanced)" group to `SAMPLE_GROUPS`

#### `QuizScreen.js`
- `typeLabel` updated to display mode-specific labels for all 5 Coordinate Grid modes
- `TOOL_REGISTRY` updated to include `"coordinate_grid"`

---

### Number Line — Redesign — 2026-04-29

Complete redesign of the Number Line tool from a single draggable-point renderer into a 5-mode educational system focused on **interval reasoning, magnitude, and pattern recognition** — not "drag dot until green."

**Design principles applied:**
- No live value readout while dragging — student acts first, then submits
- Snap-to-tick only — no free pixel dragging
- Each mode tests a distinct mathematical concept on the same number line UI

#### `NumberLineRenderer.js` — 5 modes

**`read` mode** — A pre-placed colored dot; student picks its value from 4 MC options. Distractors probe specific mistakes (adjacent tick, wrong interval count). Tick labels hidden except endpoints — student must count intervals.

**`place` mode** — Target value badge shown; student taps/drags to place a point; snaps to nearest tick; submit required. Color: purple → green/red on feedback.

**`missing` mode** — A sequence with one value replaced by a "?" badge. Student picks the missing value from 4 MC options. Tests skip-counting and pattern recognition.

**`partition` mode** — Unlabeled number line (0 and max only shown). Student counts equal parts and picks from 4 MC options. The `1 2 3 4` section-number labels appear *above* each gap (not at ticks) to reinforce that "parts" are spaces, not marks.

**`distance` mode** — Two labeled colored points (A and B) shown with a bracket/brace spanning the gap. Student picks the distance from 4 MC options. Teaches subtraction and absolute value.

#### Technical details
- Canvas width responsive: `min(screenWidth − 40, 360)` — fills the screen
- Negative number zone: red-tinted background for values left of zero
- Touch targets: 40×40 px absolute-positioned areas (larger than visible tick)
- Backward compatible: old `"mode": "count"` falls through to `partition` renderer
- `endLabelsOnly` flag on `read`/`partition` modes prevents label/notation mismatch with MC options

#### AI Wiring
- `prompts.ts`: All 5 mode schemas added; distractor strategy documented; REGEN rules updated
- `index.ts`: regen branch handles `read`, `place`, `missing`, `partition`, `distance` via `numberLineMode`
- `ScanScreen.js`: `numberLineMode` added to `questionContext`

#### `sampleQuestions.js`
- Added 5 question sets (one per mode) to the "Number Line (Enhanced)" group

---



#### `FractionBuildRenderer.js` (new — T3-B)
- New `measurementTool: "fraction_build"` renderer — **Build-a-Fraction**
- Student sets the denominator via +/− stepper (range 2–12) and taps bar segments to set the numerator
- `parseTarget()` helper supports any `"N/D"` string from AI geometry schema
- Live status hint updates progressively: wrong denominator → right denominator / wrong count → perfect
- Targeted wrong-answer explanation distinguishes "wrong denominator" vs "wrong shaded count" vs "both wrong"
- "Try Again" button appears after a wrong check (resets stepper and bar)
- Starts at a different denominator from the target so student must deliberately set it
- Connected to: `QuizScreen.js` dispatch, `sampleQuestions.js` (6 questions), `prompts.ts` `3e` section, `index.ts` regen, `TOOLS.md` T3-B

#### `FractionNumberLineRenderer.js` (new — T3-A)
- New `measurementTool: "fraction_number_line"` renderer — **Fraction Number Line** with 3 modes

**`read` mode** — Point pre-placed at `target/denominator`; only "0" and "1" labelled; student must count tick intervals to determine the fraction; 4 MC options with cross-denom distractors via `buildNLOptions()`

**`place` mode** — Target fraction badge shown (purple); all tick positions labelled; student taps a tick to place the answer dot; Check/Clear buttons

**`order` mode** — Three fraction chips shown scrambled; student taps them in ascending order (smallest first); chips show numbered badge when tapped (1, 2, 3); can de-select the last tap; auto-validates when all 3 are tapped

- Reuses existing `nlStyles`, `NL_W`, `NL_PAD`, `NL_USABLE` from `measurementStyles.js` for visual consistency with the existing NumberLineRenderer
- Touch targets are 40×40 absolute-positioned areas on each tick (larger than the visible tick for easier tapping)
- Color palette: purple (`#a78bfa`) for number line features, distinct from fraction bar green/blue/pink
- Connected to: `QuizScreen.js` dispatch (3 new type labels), `sampleQuestions.js` (24 questions across 4 sets), `prompts.ts` `3f` section (all 3 modes), `index.ts` regen (`fractionNumberLineMode`), `ScanScreen.js` (`fractionNumberLineMode` context), `TOOLS.md` T3-A

#### `sampleQuestions.js` — New Sample Sets
- `fractionBuild`: 6 questions, targets: 1/2, 3/4, 2/3, 4/5, 3/8, 5/6
- `fractionNumberLine_read`: 6 questions, denominators 2–8, various positions
- `fractionNumberLine_place`: 6 questions, all denominators 2–8
- `fractionNumberLine_order`: 4 sets of 3 fractions to order, including edge cases (0 and 1 endpoints)
- All added to new "Fraction – Build & Number Line" group in `SAMPLE_GROUPS`

#### AI Wiring
- `prompts.ts`: Added `3e. BUILD-A-FRACTION` and `3f. FRACTION NUMBER LINE` sections with full mode schemas and examples; both added to the VISUAL INTERACTION FALLBACK RULE supported-tools list
- `index.ts`: Added regen branches for `fraction_build` and `fraction_number_line` with mode-specific instructions
- `ScanScreen.js`: Added `fractionNumberLineMode` to `questionContext` object for correct regen routing

#### `TOOLS.md`
- T3-A (Fraction Number Line): status updated to "Built — 3 modes live"
- T3-B (Build-a-Fraction): status updated to "Built — build mode live"

---

### Fraction Bar — Tier 1 + Tier 2 Modes — 2026-04-27

#### `FractionBarRenderer.js` — Tier 1: Improved Distractors
- Rewrote `buildReadOptions()` to generate **cross-denominator distractors** alongside same-denominator ones
  - Strategy 1: same numerator, adjacent denominator (e.g. `3/5` when correct is `3/4`) — forces students to check the total-parts count, not just count shaded segments
  - Strategy 2: same denominator, different numerator (existing behavior)
  - Strategy 3: common-fraction pool fallback to always guarantee 3 unique distractors
- MC option buttons now render as **stacked fraction notation** (numerator / line / denominator) instead of plain slash strings, matching how fractions appear in textbooks
- `wrongExplanation()` function added — detects whether the wrong choice was a cross-denom error vs wrong-count error and returns a targeted explanation message

#### `FractionBarRenderer.js` — Tier 2: New Modes

**`compare` mode** (new)
- Two fraction bars stacked (blue top / pink bottom), each labeled with its fraction in stacked notation
- "vs" divider between bars with a subtle line
- Three answer buttons: "◀ Top is greater" | "Equal" | "Bottom is greater ▶"
- Correct answer computed **client-side** from decimal values (epsilon 0.0001) — AI's `correctAnswer` field is secondary; prevents AI arithmetic errors from showing a wrong "correct" answer
- Post-answer: shows decimal equivalents and explains which is larger

**`equivalent` mode** (new)
- Static reference bar at top (blue) with "REFERENCE" label and stacked fraction notation
- Interactive bottom bar (green) with "YOUR ANSWER" label; live `count/parts2` label updates as segments are tapped
- "=" connector between bars visually signals the goal
- Correct if `tapped.size === Math.round((shaded/parts) × parts2)`
- Post-answer explanation: spells out the multiplication relationship (`N/D = (N×k)/(D×k)`)

**`FractionLabel` helper component** (new)
- Reusable stacked fraction display (numerator / horizontal line / denominator) with configurable color and size
- Used in compare mode bar labels, shade mode target badge, and equivalent mode live counter

#### `sampleQuestions.js` — New Sample Sets
- `fractionBar_compare`: 6 questions covering same-denominator easy case, same-numerator/different-denominator, close calls (2/3 vs 3/4), and two equal-fraction pairs (2/4 = 1/2, 3/6 = 1/2)
- `fractionBar_equivalent`: 6 questions — 1/2→2/4, 1/3→2/6, 3/4→6/8, 2/3→4/6, 1/2→5/10, 4/5→8/10
- Both added to "Fraction Bar (Enhanced)" group in `SAMPLE_GROUPS`

#### `prompts.ts` — Expanded SYSTEM_PROMPT + REGEN_SYSTEM_PROMPT
- Fraction bar section rewritten with detailed specs for all 4 modes
- `compare`: rules for computing `correctAnswer` precisely; examples of close-call pairs and equal pairs
- `equivalent`: rules for choosing `parts2` so it gives a whole-number target; `correctAnswer` formula documented
- REGEN rules updated for all 4 modes with mode-specific guidance on computing `correctAnswer`

#### `index.ts` — Regen context for new modes
- `fraction_bar` regen branch now emits mode-specific instructions:
  - `compare`: tells AI to compute `correctAnswer` precisely and generate fresh fraction pairs
  - `equivalent`: tells AI to choose `parts2` that gives a whole-number result and compute `correctAnswer`

#### `TOOLS.md` — Tool 7 Updated + Tier 3 Spec Added
- Fraction Bar entry updated: status → "Built — 4 modes live", all 4 modes documented with schema examples and field table
- New section **"Tier 3 — Fraction Learning System Expansion"** added with full specs for:
  - **T3-A. Fraction Number Line** — place/read/order modes; drag-to-position interaction
  - **T3-B. Build-a-Fraction** — student sets denominator and shades numerator from scratch
  - **T3-C. Mixed Representation Match** — match bar / number-line / label cards; odd-one-out mode
  - **T3-D. Improper Fractions & Mixed Numbers** — multi-bar rendering for values > 1
  - **T3-E. Decimal ↔ Fraction Bridge** — slider-based decimal input tied to fraction bar shading

---

### Fraction Bar Tool — Initial Shell — 2026-04-27

#### Added — `FractionBarRenderer.js` (`src/renderers/tools/FractionBarRenderer.js`)

New interactive renderer for the Fraction Bar tool (Tool 7) with two modes:

- **`read` mode** — Draws a pre-shaded horizontal bar from `geometry.parts` and `geometry.shaded`. Four MC options are auto-generated client-side via `buildReadOptions()` — all fractions share the same denominator so the student must count carefully. Wrong answer shows a diagnostic message naming the correct fraction. Correct answer shows a confirmation banner.
- **`shade` mode** — Shows a target fraction badge (e.g. "Shade 3/4 of the bar"). Student taps individual segments to shade them; tapping a shaded segment unshades it. A live counter shows the tapped count with an amber warning if too many are tapped. Check button validates that `tapped.size === geometry.shaded`. Wrong answer explains how many more or fewer are needed.

Bar is drawn entirely in code:
- `flexDirection: 'row'` container with `flex: 1` segments at `BAR_H = 64px`
- First and last segments carry `borderRadius: 12` for clean pill ends
- `SEG_GAP = 3px` gaps between segments reveal dark container background as natural dividers
- Unshaded: `#1e293b`; shaded: `#4ade80`; correct feedback: `#22c55e`; wrong feedback: `#ef4444`

#### Changed — `QuizScreen.js`

- **Import** — added `FractionBarRenderer` import
- **Type badge** — fraction bar questions display `Fraction Bar · Read` or `Fraction Bar · Shade`
- **Render dispatch** — added `qType === 'fill_in' && q.measurementTool === 'fraction_bar'` branch before the generic `FillInRenderer` fallback

#### Changed — `sampleQuestions.js`

Added 2 new sample sets for dev preview:
- `fraction_bar_read` — 6 questions: halves, quarters, thirds, fifths, eighths, sixths
- `fraction_bar_shade` — 6 questions: shade 1/2, 3/4, 1/3, 4/5, 3/8, 5/6

Added **"Fraction Bar (Enhanced)"** group to `SAMPLE_GROUPS`.

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/prompts.ts`)

- **`SYSTEM_PROMPT` extended** — added `3d. FRACTION BAR` section documenting both modes (`read` and `shade`) with geometry schema, correctAnswer formats, randomisation rules, consistency rule, standard mix-in questions, and two worked JSON examples; fraction_bar added to the `VISUAL INTERACTION FALLBACK RULE` supported-tools list so GPT knows not to fall back to plain MC on fraction worksheets
- **`REGEN_SYSTEM_PROMPT` extended** — added `CLOCK` regen rules (missed when Clock tool was built) and `FRACTION BAR` regen rules; both sections document mode-specific geometry shapes and correctAnswer formats and instruct GPT to generate fresh values rather than copying the original

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **Regen handler enriched with clock + fraction_bar tool context** — added `else if` branches for `measurementTool === 'clock'` (clockMode directive, was missing) and `measurementTool === 'fraction_bar'` (fractionBarMode directive); both append a one-line `ORIGINAL TOOL:` prefix to the user message so GPT always regenerates the same interactive tool type instead of falling back to plain fill_in

#### Changed — `ScanScreen.js` (`src/screens/ScanScreen.js`)

- **`handleRegenerate` passes fraction_bar mode context** — `fractionBarMode` field added to the `questionContext` object; set to `existing.geometry?.mode` when `measurementTool === 'fraction_bar'` (avoids overwriting `coinMode` which also reads `geometry.mode`)

#### Changed — `TOOLS.md`

Updated Fraction Bar entry: status → `Shell Built — AI schema wiring pending`; added full 2-mode spec, field table, validation model, and build notes. Clarified that `measurementTool: "fraction_bar"` is used (matching existing tool convention) rather than the `toolType` field originally noted in the spec.

---

### Analog Clock Tool — Initial Shell — 2026-04-27

#### Added — `ClockRenderer.js` (`src/renderers/tools/ClockRenderer.js`)

New interactive renderer for the Analog Clock tool with four modes:

- **`read` mode** — Draws a procedural clock face at a fixed time (`geometry.hours`, `geometry.minutes`). Student types the time in `H:MM` format; input is normalised before matching the `correctAnswer`. Shake animation on invalid input, reveal of correct time on wrong answer.
- **`set` mode** — Displays a digital target time badge. Student uses two independent sliders (Hour 1–12, Minute 0–55 in 5-min steps) to move both clock hands. Diagnostic feedback distinguishes "hour right, minute wrong" / "minute right, hour wrong" / "both wrong". Slider colours match hand colours (purple = hour, green = minute).
- **`estimate` mode** — Draws a clock at an imprecise time (e.g. 8:47). Four MC buttons are generated client-side by `buildEstimateOptions()` at 15-minute boundaries; the correct option is the nearest boundary. Reuses `measStyles.estimateGrid` / `estimateBtn` styles from the shared measurement style sheet.
- **`spot_mistake` mode** — Draws a clock, renders two character claim cards (with avatar images), and an optional "They are both wrong" button. Supports `correctClaim: "A"`, `"B"`, or `"neither"`. Reuses `measStyles.claimRow`, `claimBtn`, `neitherBtn`, and `spotExplanation` from the shared style sheet.

Clock face is drawn entirely in code:
- `View` circle background with purple glow border
- 12 hour number labels positioned via `Math.cos/sin` around `HOUR_LABEL_R = 76`
- `armStyle()` helper from `measurementHelpers.js` draws both hands using the midpoint-rotation trick
- Center dot `View`; no SVG or image assets required

#### Changed — `QuizScreen.js`

- **Import** — added `ClockRenderer` import
- **Type badge** — clock questions now display contextual badge: `Clock · Read`, `Clock · Set`, `Clock · Estimate`, `Clock · Spot the Mistake`
- **Render dispatch** — added `qType === 'fill_in' && q.measurementTool === 'clock'` branch before the generic `FillInRenderer` fallback

#### Changed — `sampleQuestions.js`

Added 4 new sample sets for dev preview:
- `clock_read` — 5 questions: O'clock, half past, quarter past, quarter to, and a :20 time
- `clock_set` — 5 questions: 4:30, 1:00, 6:15, 10:45, 8:10
- `clock_estimate` — 4 questions with imprecise times (8:47, 3:04, 12:13, 5:32)
- `clock_spotMistake` — 4 questions with Nina/Sam/Leo/Mia/Ava/Max characters

Added **"Analog Clock (Enhanced)"** group to `SAMPLE_GROUPS`.

#### Changed — `TOOLS.md`

Updated Clock entry: status → `Shell Built — AI schema wiring pending`; added full 4-mode spec, field table, avatar name list, validation model, and build notes.

---

### Protractor AI Schema Wiring — 2026-04-27

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/prompts.ts`)

- **`REGEN_SYSTEM_PROMPT` extended** — added a full `MEASUREMENT TOOL REGEN RULES` block covering all three interactive tools:
  - **Protractor** — documents all 5 modes (`read`, `build`, `align`, `estimate`, `spot_mistake`) with mode-specific angle pools, vertex/ray label rules, flipped orientation rules, `claimA`/`claimB`/`correctClaim` schema for `spot_mistake`, and two worked JSON examples; regenerating a protractor question now always returns a fresh protractor question (never a plain fill_in fallback)
  - **Ruler** — documents all 4 subtypes (`endpoint`, `offset`, `compare`, `difference`) with geometry shapes
  - **Coin** — documents all 5 modes (`count`, `make`, `estimation`, `spot_mistake`, `fewest`) with geometry shapes

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **Regen handler enriched with tool context** — when `body.questionContext` is present, the user message sent to GPT is prefixed with a one-line `ORIGINAL TOOL:` directive naming the `measurementTool` and the mode/subtype; this is appended before the user message and explicitly directs GPT to generate a replacement that preserves the same tool schema; handled for `protractor`, `ruler`, and `coin`

#### Changed — `aiService.js` (`src/services/aiService.js`)

- **`regenerateQuestion(base64Images, existingQuestion, isVisual, questionContext)` — new 4th param**; when `questionContext.measurementTool` is present, the object is forwarded in the request body as `questionContext` so the edge function can build the tool directive; backwards compatible (defaults to `{}`)

#### Changed — `ScanScreen.js` (`src/screens/ScanScreen.js`)

- **`handleRegenerate` passes tool context** — now builds a `questionContext` object from the existing question's `measurementTool`, `type`, `geometry.protractorMode`, `geometry.mode` (coin), and `rulerSubtype` fields and passes it to `regenerateQuestion`; protractor/coin/ruler questions now regenerate as the correct interactive tool type instead of falling back to plain fill_in

#### Changed — `TOOLS.md`

- Protractor status updated from "Shell Built — AI schema wiring pending" to **"Done — shell built, AI schema wired, regen wired"**
- Build notes updated to document `enrichDrawAngleQuestions` auto-upgrade behaviour and the full regen pipeline

---

### Lesson Intro Audio & Glassmorphism Intro Screen — 2026-04-24

#### Added — Lesson Intro Audio Pipeline

- **`lesson_intro` field** — GPT-4o now generates a 3–5 sentence spoken lesson overview ("lesson_intro") for every scan: a friendly teacher voice that explains the key concepts before the quiz starts; written as natural prose (no bullet points, no quiz references) for TTS playback
- **`image_search_query` field** — GPT-4o also generates 2–4 Pexels keywords ("image_search_query") matching the lesson topic; used to automatically fetch 3 royalty-free background photos
- **Pexels stock photo fetch** — `generate-questions` Edge Function fetches 3 full-size photos from Pexels immediately after GPT responds (using `PEXELS_API_KEY` secret); URLs included in the response so the parent sees a photo preview in `ScanScreen` before saving
- **`generate-audio` extended** — now accepts `lesson_intro` (TTS) and `intro_image_urls` (pre-fetched photo URLs); generates `intro.mp3` via OpenAI TTS, uploads to Supabase Storage, and patches `custom_units` with `intro_audio_url` and `intro_image_urls`
- **`lesson_intro` and `intro_image_urls` columns** added to `custom_units` table (`TEXT` and `JSONB` respectively); `lesson_intro` saved immediately on unit creation so the intro screen can show before audio is ready

#### Added — ScanScreen: Intro Audio Toggle & Photo Preview

- **"Lesson Intro Audio" toggle** (`Switch`) in the ScanScreen review step — parents can enable or disable the audio intro before saving; defaults to on when a `lesson_intro` was detected
- **Photo preview strip** — shows thumbnail chips for each fetched Pexels photo; parent can remove individual photos before saving; removed photos are excluded from `generate-audio`
- `generateAudio` fire-and-forget call passes `lessonIntro` and the curated `introImageUrls` (or `null` if toggle is off)

#### Added — QuizScreen: Glassmorphism Intro Screen

- **Intro screen shown immediately** — `introPhase` is now set based on `unit.lesson_intro` (text presence, not audio URL) so the intro screen displays the moment a quiz opens; no need to close and reopen
- **`audioLoading` state** — while the background `generate-audio` job is still running, an `ActivityIndicator` replaces the play button; lesson text is always visible
- **Background polling** — `useEffect` polls Supabase every 3 s for `intro_audio_url` and `intro_image_urls`; clears `audioLoading` and starts Ken Burns animation as soon as audio is ready
- **Ken Burns photo background** — up to 3 Pexels photos animate with slow pan/zoom (`Animated.Image`) as a full-bleed background behind the intro UI
- **Glassmorphism / visionOS UI** — intro elements (header, main card, action buttons) are `BlurView` panels (`expo-blur`, dark tint) with a subtle white border and transparency, layered over the full-brightness photos
- **Animated wave bars** — 5 vertical bars animate up and down while audio plays, simulating a live waveform
- **Timing progress bar** — a left-to-right fill bar at the bottom of the card (driven by `onPlaybackStatusUpdate`) gives a visual indication of audio duration with no numbers
- **Dynamic subtitle** — changes between "Preparing audio…", "Tap play to hear the lesson intro", and "Playing…" based on `audioLoading` / `introPlaying` state
- **`expo-blur` installed** (`npm install expo-blur`)

#### Changed — `aiService.js`

- `generateQuestionsFromImage` return value now explicitly forwards `lesson_intro`, `image_search_query`, and `intro_image_urls` from the Edge Function response
- `generateAudio(unitId, questions, lessonIntro, imageUrls)` — new signature; passes `lesson_intro` and `intro_image_urls` to `generate-audio`

#### Changed — `supabase.js`

- `saveCustomUnit` accepts `lessonIntro` (8th arg) and persists it to `custom_units.lesson_intro` immediately on save

#### Changed — `sanitize.ts` (`generate-questions`)

- `sanitizeResponse` passes through `lesson_intro`, `image_search_query`, and `intro_image_urls` from the AI response body

---

### Coin / Money Tool — Dollar Bills & Full Dev Coverage — 2026-04-24

#### Changed — `CoinRenderer.js` (`src/renderers/tools/CoinRenderer.js`)

- **Dollar-aware count input** — `CountMode` now detects when the correct total is ≥ $1.00 (`isDollar = actual >= 100`) and switches the input to a `$` prefix + `decimal-pad` keyboard with a `0.00` placeholder; totals under $1.00 keep the existing `¢` suffix + number-pad; validation accepts both dollar format (`1.35` → 135¢) and bare-cents format (`135`) so neither input style fails

#### Changed — `sampleQuestions.js` (`src/dev/sampleQuestions.js`)

- **`coin_count`** — added 4 questions using `dollar`, `five_dollar`, and `ten_dollar` denominations ($1.35, $5.50, $11.30, plus a mixed $1+$1+coins question)
- **`coin_make`** — added 2 questions with dollar-range targets ($1.25 and $6.50) and explicit `availableCoins` pools containing bill denominations
- **`coin_estimation`** — added 2 questions featuring a `$1 + quarters` group ($1.75) and a `$5 + coins` group ($5.30)
- **`coin_spotMistake`** — added 2 questions: Ava vs Max ($1.35 with dollar bill) and Sam vs Nina ($5.30 with $5 bill)
- **`coin_fewest`** — added 2 questions: Make $1.25 in 2 pieces (dollar + quarter) and Make $5.50 in 3 pieces ($5 + 2 quarters)
- **`coin_standard`** — added 4 standard questions involving paper bills: $5 change problem, $1-bill count, true/false ($5 vs quarters), $10 word problem
- **`coin_dollars`** — new sample set (7 questions) exclusively focused on `$1`, `$5`, and `$10` bills across all 5 interactive modes; added to the `Coin / Money (Enhanced)` group in `SAMPLE_GROUPS`
- **`mixed_coins`** — updated showcase: Count mode now includes a `$1 + 2 quarters` question ($1.50); Make now targets $1.25 with a bill pool; Fewest now targets $1.50 (3 pieces); standard questions use bills

#### Changed — `TOOLS.md`

- Updated Coin/Money description to explicitly list `$1`, `$5`, `$10` bills alongside coins
- Updated validation model entry for `count` mode to document dual-mode parsing
- Updated build notes to document `availableCoins` bill support in `make`/`fewest` modes and the dual-input behavior

---

### Question Generation Quality & Count Reliability — 2026-04-24

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **Over-generate buffer** — GPT is now asked for `questionCount + 40%` questions (e.g. 28 for a 20-question request) so Pass-2 filtering never leaves the final set short; `max_tokens` raised from 8000 → 10000 to accommodate the larger payload
- **Exact-count trim** — after Pass-2 validation the question list is sliced to exactly `questionCount` before the shortfall check; surplus questions are silently discarded; a log line confirms the trim
- **Retry asks 2× shortfall** — if still short after the trim, the retry pass requests `shortfall × 2` questions instead of `shortfall`, so one bad question can no longer leave the quiz one short
- **Retry prompt steers toward safe types** — retry now explicitly says "do NOT generate questions that reference a diagram, image, chart, or visual not rendered by the app; prefer definitions, true/false, vocabulary, calculations, or concept questions"
- **`generated_count` / `requested_count` fields** — added to the API response body when the final delivered count is less than requested; only present on shortfall; zero overhead on normal runs
- **Measurement tool consistency rule** — new rule blocks cross-tool contamination: a protractor worksheet may only produce `measurementTool:"protractor"` questions; a ruler worksheet may only produce `measurementTool:"ruler"` questions; previously GPT padded protractor lessons with unrelated ruler questions when generating large sets
- **`enrichDrawAngleQuestions`** (new function in `enrich.ts`) — server-side enricher that runs alongside `enrichNumberLineQuestions`; detects plain `fill_in` questions whose text matches `Draw/Construct/Sketch a X° angle [at point Y]` with no `measurementTool` attached, and auto-upgrades them to a full protractor `build`-mode question with correct `geometry`, `ray1`/`ray2` letters, random flip orientation, and `selfContained: true`; the child gets an interactive draggable-arm protractor instead of a confusing text box
- **Validator `max_tokens`** raised from 300 → 600 to handle the larger question sets sent to Pass-2

#### Changed — `generate-questions` Prompt (`supabase/functions/generate-questions/prompts.ts`)

- **DRAW / CONSTRUCT / SKETCH RULE** added to the fill_in section — instructs GPT that any question using these verbs for an angle MUST include `measurementTool:"protractor"` + `protractorMode:"build"` + a complete geometry object; plain fill_in without a tool is explicitly forbidden
- **MEASUREMENT TOOL CONSISTENCY RULE** added to the ruler/protractor section — cross-tool generation is forbidden; the tool used must match what the scanned worksheet is about

#### Changed — `aiService.js` (`src/services/aiService.js`)

- Passes `generated_count` and `requested_count` through onto the returned unit object when present in the API response, so the UI can surface a shortfall notice

#### Changed — `ScanScreen.js` (`src/screens/ScanScreen.js`)

- **`shortfallNotice` state** — set after generation completes when `generated_count < requested_count`; cleared on each new scan
- **Amber shortfall banner** — rendered at the top of the question list in the review step when a shortfall occurred; explains how many questions were generated vs. requested and why (diagram-based questions removed), and points the parent to the refresh button to fill slots manually; shown only in the parent review step, never seen by the child

---

### Angle Questions — Full 8-Type System & Protractor Polish — 2026-04-24

#### Added — New question types

- **`AngleMatchingRenderer.js`** (`src/renderers/tools/AngleMatchingRenderer.js`) — new tap-to-match renderer for `type: 'angle_matching'`; shows 3 mini angle drawings in rows, a shuffled bank of degree chips, and auto-checks when all 3 rows are filled; supports steal-and-reassign, reset, and correct/wrong feedback with per-row reveal
- **Angle Type Identification** sample set — standard `multiple_choice` question using `geometry: { type: 'angle' }` to display an angle drawing; tests Acute / Obtuse / Right / Straight classification with hints
- **Angle Matching** sample set — two sets of 3-pair matching questions (45°/90°/120° and 30°/60°/150°) exercising the new renderer
- **Word Problem – Angles** sample set — four fill-in and MC word problems (lighthouse elevation, clock rotation, flat book angle, skateboard ramp) requiring angle reasoning without a tool

#### Changed — `GeometryDisplay.js` (`src/renderers/shared/GeometryDisplay.js`)

- Added `type: 'angle'` branch that renders an `AngleStimulus` component; allows standard `multiple_choice` questions to display a geometric angle drawing without needing a tool renderer

#### Changed — `sampleQuestions.js` (`src/dev/sampleQuestions.js`)

- Protractor (Enhanced) group expanded from 5 to 8 entries; all 8 mockup question styles are now represented in Dev Preview

#### Changed — `quizHelpers.js` (`src/utils/quizHelpers.js`)

- Added `angle_matching: 'Angle Matching'` to `TYPE_LABELS`

#### Changed — `QuizScreen.js` (`src/screens/QuizScreen.js`)

- Imported `AngleMatchingRenderer` and added dispatch case for `type: 'angle_matching'`
- **Type badge now shows the specific protractor mode** instead of "Fill in the Blank": `Protractor · Read`, `Protractor · Build`, `Protractor · Align`, `Protractor · Estimate`, `Spot the Mistake`, `Angle Type`, `Ruler`

#### Changed — `ProtractorRenderer.js` (`src/renderers/tools/ProtractorRenderer.js`)

- **`ProtractorFace` redesigned** to match mockup visual quality:
  - Filled blue sector from vertex to arc edge shows the measured angle at a glance
  - Degree labels moved **inside** the arc (radius −13 from edge) creating a clear label belt; 49 px of separation from ray letters vs. 14 px before
  - **Dual scale** — primary labels every 10° (bold + ° symbol at 30° multiples), secondary complementary values (150/120/90/60/30) on inner ring
  - Tick marks at 5° (minor), 10° (medium), and 30° (major) with varying lengths and weights
  - Inner arc ring creates a visual protractor belt
  - **Arm pip**: bright dot placed on the arc exactly where the movable arm intersects, so in-between positions (e.g. 75°) are precisely marked
  - **Floating degree badge**: small colored pill showing the exact angle (e.g. "75°") travels with the arm just outside the arc — eliminates the ambiguity of two neighboring labels both lighting up
  - `near` highlight threshold tightened from ±6° to ±3° so only one label highlights at a time
  - `overflow: 'visible'` on container; ray labels enlarged to 15 px / weight 900
- **Align mode Step 2 gated**: Next button is blocked when the movable arm is more than 10° from the correct angle; shows `"That arm doesn't look lined up yet — try moving it closer to match the ray"` warning
- **Estimate mode diagnostic feedback**: wrong answer triggers a contextual amber banner explaining the angle type (acute vs. obtuse) and why the correct option fits
- **Spot the Mistake post-answer explanation**: blue banner names which student used the correct 0° line and explains that the other got the supplementary angle
- **Build mode relational hint**: after a wrong attempt shows whether the target is acute/obtuse and where the arm should sit relative to the 90° mark
- Step 2 instruction updated from generic "Align the protractor" to `"Move the purple arm until it lines up with ray Z. Start from the 0° baseline."`

#### Changed — `measurementStyles.js` (`src/renderers/shared/measurementStyles.js`)

- `protContainer`: added `overflow: 'visible'` so ray labels can extend beyond container bounds
- `protRayLabel`: font size 13 → 15, weight 800 → 900
- Added `spotExplanation` / `spotExplanationText` styles for the post-answer scale banner
- Added `alignWarnText` style for the arm-alignment warning
- Added `estimateDiagnostic` / `estimateDiagnosticText` styles for the estimate feedback banner

---

### Dev Preview & Web Compatibility — 2026-04-24

#### Added — Dev Preview infrastructure

- **`src/dev/sampleQuestions.js`** — comprehensive sample question library covering every type and variant: multiple choice (basic, with context card, with image), visual MC, fill-in, true/false, word bank, ordering, number line (place / read / count), protractor (align / read / build / estimate / spot-mistake), ruler (endpoint / offset / compare / difference), geometry display (pie / bar / shape), read-along passage, and two "⭐ Mixed" sets that cover all standard and all enhanced tool types in one go
- **`src/screens/DevPreviewScreen.js`** — developer-only menu screen listing all sample sets grouped by category; tapping any card launches `QuizScreen` with that pre-built question set — no scan, no login required
- **`web/index.html`** — custom Expo web HTML template; sets `html, body { height: 100% }` and `#root { display: flex; height: 100% }` so React Native Web's `flex: 1` layout has a proper pixel height to stretch against throughout the entire app

#### Changed — `App.js`

- `DevPreviewScreen` imported and registered in both the authenticated and unauthenticated stack navigators so it is reachable regardless of login state
- `GestureHandlerRootView` now receives `height: '100vh'` on web — the root fix that makes every screen's `ScrollView` scroll correctly without per-screen overrides

#### Changed — `WelcomeScreen`

- Wrapped content in a `ScrollView` so buttons are always reachable at any window height
- Added `pointerEvents="none"` to all `FloatingBubble` components — the absolutely-positioned decorative bubbles were intercepting every tap and scroll event on web, making all buttons unclickable
- Added `__DEV__`-gated **"🔧 Dev Preview"** button at the bottom of the screen; hidden in production builds

#### Changed — `QuizScreen`

- `useWindowDimensions` added; quiz `ScrollView` receives an explicit pixel height on web (`windowHeight - 120`) so question content is always scrollable regardless of parent container chain

---

### Protractor Multi-Mode Improvements — 2026-04-24

#### Changed — `ProtractorRenderer` (`src/renderers/tools/ProtractorRenderer.js`)

- Full renderer rewrite with cleaner mode dispatch, improved `ReadBuildMode` layout, and tighter `AlignMode` step flow
- `spot_mistake` avatar lookup is now fully case-insensitive; handles all 6 child avatar keys (`nina`, `sam`, `mia`, `leo`, `ava`, `max`)
- Slider stale-closure pattern hardened: all PanResponder callbacks read from mutable refs rather than closed-over state values, preventing gesture rejection after any re-render

#### Changed — `measurementStyles.js` (`src/renderers/shared/measurementStyles.js`)

- Extracted shared measurement layout constants and style tokens used by both `ProtractorRenderer` and `RulerRenderer`; eliminates duplicated style blocks across tool renderers

#### Changed — `generate-questions` prompts (`supabase/functions/generate-questions/prompts.ts`)

- Protractor schema examples updated to include all five modes with correct field sets
- `spot_mistake` mode: `claimA`/`claimB`/`correctClaim` fields documented with the full avatar name list
- `scaleOrigin` pairing rules clarified: `"left"` for flipped or obtuse angles, omit for acute normal-orientation

---

### Number Line Pipeline — Full Fix — 2026-04-23

#### Root Cause Fixed — `aiService.js` (`src/services/aiService.js`)

- **`mode` field was silently dropped** in both `generateQuestionsFromImage` and `regenerateQuestion` mappers — every `number_line` question arrived at QuizScreen without a mode, forcing `place` (drag) regardless of what the server sent
- **`options` / `correctIndex` / `correctAnswer` were not mapped for `number_line` type** — the MC options for `read` and `count` modes were discarded before reaching the renderer
- **`rulerSubtype` was also missing** from the mapper — added for completeness
- Both mapper functions now correctly forward: `mode`, `rulerSubtype`, and the full `number_line` type block (`correctAnswer`, `acceptedAnswers`, `options`, `correctIndex`)

#### Added — `generate-questions` Edge Function

- **`enrichNumberLineQuestions` function** — runs between Pass-1 logging and Pass-2 validation; deterministically repairs GPT's common failures:
  - **Count-mode auto-enrichment**: detects "how many equal parts" text patterns, computes `numSteps` from geometry, auto-generates shuffled MC options, normalizes question text, forces `mode:"count"` — no GPT cooperation required
  - **Read-mode auto-enrichment**: detects "what fraction does the point represent" / "name of the point" patterns, resolves `geometry.target` from `correctAnswer` or option text via `parseFractionOrDecimal`, normalizes question text to "A point is marked on the number line below…", forces `mode:"read"`; drops question if no options are present (unrenderable)
  - **Count-mode geometry validation** (for GPT-generated `mode:"count"` questions): if `numSteps` computed from `step` doesn't match `correctAnswer`, recalculates `step` so the drawn line is always consistent with the claimed answer
  - **Read-mode guard**: drops explicit `mode:"read"` questions that have no `options` array
- **Retry pass**: after Pass-2 filtering, if `kept < questionCount`, a single follow-up GPT call requests exactly the shortfall, passing already-covered topics to avoid duplicates; retry batch goes through the same enrichment + Pass-2 pipeline
- **Pass-2 unconditional Rule 0**: `nlMode="count"` or `nlMode="read"` → always pass (server has already validated geometry/options/target); eliminates false drops caused by "this number line" language in question text
- **`parseFractionOrDecimal` helper** — parses both `"1/4"` fraction strings and decimal strings to `number`; used by enrichment to resolve read-mode targets
- **`shuffleInPlace` helper** — Fisher-Yates shuffle for auto-generated MC option arrays

#### Fixed — `QuizScreen` (`src/screens/QuizScreen.js`)

- **`NumberLineRenderer` read-mode target**: was using `parseFloat(correctAnswer)` first — fails silently for fraction strings like `"1/4"` (returns `NaN`); now prefers `geo.target` (always a number set by enrichment), falling back to `parseFloat` only for legacy questions; dot was invisible before this fix
- **Read + count modes now show only endpoint labels** (`endLabelsOnly`) — intermediate tick labels (e.g., `½`) used different notation than MC answer options (e.g., `2/4`), confusing students; removing them eliminates the mismatch
- **Count mode section numbers**: small `1 2 3 4…` labels now appear above each gap between tick marks, making it visually clear that "equal parts" means the *spaces* not the tick marks themselves; eliminates the common student mistake of counting ticks instead of sections
- **`min`/`max` reference error in `NumberLineRenderer`**: `read` mode dispatch block referenced `min`/`max` variables that were only in scope inside child components; fixed by deriving `gMin`/`gMax` locally from `q.geometry`
- **`nlStyles.sectionNum`** — new style for the section-number labels

### Number Line Read + Count Modes — 2026-04-23

#### Added — `QuizScreen` (`src/screens/QuizScreen.js`)

- **`number_line` renderer refactored into three modes:**
  - **`place`** (default): existing drag-to-target behavior — unchanged
  - **`read`**: app draws the number line with a pre-placed colored dot; student picks the fraction/value from 4 MC options. Handles worksheet questions like "What fraction does the point represent?" and "What is the name of the point shown in purple?"
  - **`count`**: app draws the number line with equal-part tick marks; student picks the count from 4 MC options. Handles "How many equal parts is this number line divided into?"
- **`StaticNumberLine` component** — shared by `read` and `count` modes; draws line, ticks, labels, and an optional pre-placed dot (no drag handlers)
- **`NLMCMode` component** — shared MC interaction layer for `read` and `count`; same color feedback logic as `CompareRulerVariant`
- **`NLPlaceMode` component** — the existing drag behavior extracted for clarity
- **`useNLGeo` hook** — extracts and normalizes geometry fields (`min`, `max`, `step`, `numSteps`, `ticks`, `labelEvery`) shared across all three modes; eliminates repeated parsing
- **`NL_POINT_COLORS` map** — named color values (`green`, `blue`, `purple`, `orange`, `red`, `yellow`) for pre-placed dots

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **`number_line` prompt expanded with Modes B and C:**
  - Mode B (`read`): transformation rule for worksheet "labeled point on a number line" questions → app draws the line + dot, student identifies the value; requires `options`, `correctIndex`, `geometry.target`, optional `geometry.pointColor`
  - Mode C (`count`): transformation rule for "how many equal parts?" questions → app draws the line with equal parts; requires `options`, `correctIndex`; `step` determines the part count
- **`sanitizeQuestion` updated** — passes through `mode`, `options`, `correctIndex` for `number_line` questions
- **Pass-2 validator updated** — recognizes that `hasGeometry: true` means the app draws its own visual; questions referencing "the number line below" or "a point is marked" with geometry now correctly PASS instead of being dropped

### Pass-2 Validation Hardening — 2026-04-23

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **Pass-2 validation prompt tightened** — gpt-4o-mini reviewer now explicitly catches the subtle `"this [noun]"` pattern that previously slipped through:
  - "How many equal parts are on **this** number line?" → FAIL (number line not in question text)
  - "What is the name of **the** point?" → FAIL (which point? not described in text)
  - Multiple-choice options explicitly noted as NOT rescuing an externally-dependent question
- **Empty-lesson guard** — if Pass-2 drops every question (worksheet is entirely diagram-dependent), the server now returns `{ valid: false, reason: "..." }` with a friendly message instead of saving an empty lesson. The app's existing content-validation error UI handles this gracefully.

---

### Self-Contained Field, Number Line Renderer & Ordering Fix — 2026-04-23

#### Added — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **`selfContained` required field** — every generated question must now include `"selfContained": true` or `false`. GPT must ask itself "could a child answer this without seeing the worksheet?" before writing the field. If the answer would be `false`, it must transform the question first. Writing `false` is only allowed when transformation is impossible.
- **Server-side filter** — `sanitizeResponse` now filters out any question where `selfContained === false` before the response is returned or saved. The field is then stripped from the output so the client never sees it.
- **Diagnostic logging** — every scan now logs to Supabase Edge Function logs:
  - One line per GPT-generated question: `✅` (selfContained:true), `❌` (selfContained:false, will be dropped), or `⚠️` (field missing entirely)
  - A summary line: `raw=N kept=N dropped=N missingField=N`
  - A `DROPPED` warn log listing the question text of any filtered questions
  - A `missingField` warn log listing questions that skipped the self-check entirely
- **`HOW TO TRANSFORM` examples** — self-contained rule now includes positive BAD→GOOD rewrites for sequences, charts, diagrams, rulers, and images instead of relying solely on a forbidden-phrase blocklist
- **`number_line` question type** — new type `"type": "number_line"` for "place a point at X" questions; student drags a point on a rendered number line; tolerance ±half a step; supports integers, fractions, and decimals
  - Schema: `{ "geometry": { "min": 0, "max": 1, "step": 0.25, "target": 0.75 } }`
  - Guardrail: max 20 tick intervals; grade-appropriate range examples in prompt
- **`7.G.0` fallback rule** — GPT must fall back to `multiple_choice` for any question format it cannot render (clocks, coordinate grids, Venn diagrams, etc.) rather than producing broken JSON

#### Added — `QuizScreen` (`src/screens/QuizScreen.js`)

- **`NumberLineRenderer`** — new renderer for `"type": "number_line"` questions:
  - Draws a labeled horizontal number line (min → max with tick marks at every step)
  - Draggable point (purple) snaps to nearest step; turns green/red on submit
  - Live readout shows selected value while dragging; hidden until first drag
  - Displays fractions as ¼ ½ ¾ glyphs when step ≤ 0.5, decimals with correct precision otherwise
  - Post-answer reveal: correct position label on pass; chosen vs. correct on fail
  - Shake animation + haptics on wrong answer
- **`useNumberLineDrag` hook** — `PanResponder`-based drag hook following the same stale-closure-safe pattern as `useRulerDrag`; `lockedRef` blocks dragging after submission
- **`formatNLValue(v, step)`** — formats number line values: whole numbers as integers, quarter/half fractions as ¼ ½ ¾, decimals with step-appropriate precision
- **`NL_W / NL_PAD / NL_USABLE` constants** — layout constants for the number line component
- **`nlStyles`** — dark-themed StyleSheet for the number line (line bar, ticks, labels, draggable point)
- **`number_line` label** — added to `TYPE_LABELS` map as `'Number Line'`

#### Fixed — `QuizScreen` (`src/screens/QuizScreen.js`)

- **Ordering: no way to undo a placed chip** — tapping a filled slot now removes that chip and all chips placed after it (rewinds the order to that point), allowing correction without clearing everything. A small `✕` badge appears on each filled slot to signal it is tappable.

---

### Ruler Question Subtypes, Self-Contained Guardrails & Subtype Routing Fix — 2026-04-23

#### Added — `QuizScreen` (`src/screens/QuizScreen.js`)

- **Four ruler subtypes** — `RulerRenderer` now dispatches to one of four specialised variant components based on `rulerSubtype`:
  - `EndpointRulerVariant` — original drag-to-endpoint style ("How long is the red bar?")
  - `OffsetRulerVariant` — bar starts at a non-zero position; student measures *length* not endpoint ("The bar starts at 2 in. How long is it?")
  - `CompareRulerVariant` — two bars shown via `TwoBarStimulus`; three-button multiple-choice ("Which bar is longer?")
  - `DifferenceRulerVariant` — student drags to find the difference between two bar lengths ("How much longer is the red bar?")
- **`TwoBarStimulus` component** — renders two color-coded bars stacked above a shared ruler with correct tick/label density; used by compare and difference variants
- **`useRulerDrag` custom hook** — extracted shared `PanResponder` drag logic reused across endpoint, offset, and difference variants
- **`InteractiveRuler` component** — reusable draggable ruler with snapping, live readout, and scroll-lock; used by all drag variants
- **Post-answer explanations** — every variant shows a color-aware, subtype-specific explanation after the student checks their answer:
  - Correct endpoint: "The bar ends at the X mark, so its length is X in."
  - Wrong offset: "The bar starts at S and ends at E, so its length is E − S = X."
  - Correct compare: "Correct! 📏"
  - Wrong difference: "The red bar is R and the blue bar is B. The difference is R − B = X."
- **`inferRulerSubtype(q)` function** — detects the correct variant when `rulerSubtype` is missing from stored question data (old server sanitizer didn't preserve the field):
  - `correctAnswer` is a color name (red/blue/green/orange/purple/yellow) → `compare`
  - `geometry.start > 0` → `offset`
  - Question text contains "how much longer" / "difference between" → `difference`
  - `geometry.bar2` present → `compare`
  - Otherwise → `endpoint`
- **NaN guards** — all three numeric ruler variants now handle `parseFloat(correctAnswer)` returning `NaN` (e.g. when a compare question is mistakenly routed to a drag variant) with a safe fallback value, preventing invisible bars and "NaN in" text
- **`shuffleNoConsecutiveDupes`** — shuffled question list is checked to ensure no answer appears three times in a row; reshuffled until the constraint is satisfied

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)

- **Ruler subtype prompt** — `── LENGTH (ruler) ──` section expanded to define all four subtypes with geometry parameters, `correctAnswer` formats, and JSON examples for each
- **`sanitizeQuestion` updated** — passes through `rulerSubtype` field so variant routing works for freshly generated questions (fix for the server-side stripping that `inferRulerSubtype` works around on the client)
- **Universal self-contained rule** — `SELF-CONTAINED QUESTION RULE` made universal; applies to *all* question types, not just ruler
- **`── UNIVERSAL FORBIDDEN PHRASES ──`** list added — explicit ban on patterns that reference external visuals: "in the image", "on the worksheet", "this ruler", "the second ruler", "the arrow", "shown by the arrow", "in question N", "numbered item", "on the diagram", etc.
- **`── HOW TO FIX EACH CASE ──`** section — BAD→GOOD transformation examples for charts/graphs, maps, rulers, and pictures so GPT rewrites rather than references
- **`RULER / MEASUREMENT WORKSHEET EXCEPTION`** — overrides "faithful reproduction" for measurement questions; mandates transformation into geometry-based or general-knowledge questions
- **`ANSWER INDEPENDENCE CHECK`** in pre-output checklist — catches questions where the *correct answer itself* varies across worksheet versions even if the phrasing looks clean (e.g. "What unit is used on this ruler?")

#### Fixed — `QuizScreen` (`src/screens/QuizScreen.js`)

- **Compare questions showing NaN** — `CompareRulerVariant` was never reached because `rulerSubtype` was stripped by the old sanitizer; `EndpointRulerVariant` received `correctAnswer: "green"`, `parseFloat` returned NaN, collapsing bar widths to 0px and rendering all text as "NaN in". Fixed by `inferRulerSubtype` + NaN guards.
- **Offset wrong-answer feedback** — "Start at 0 and look where the bar ends" was shown for offset questions (bar starts at non-zero); now routed to `OffsetRulerVariant` which explains "The bar starts at S and ends at E — subtract to get the length."
- **Unit label overlap ("in4")** — inline unit label removed from both `SegmentStimulus` and `InteractiveRuler`; unit now appears once in the section header ("YOUR MEASUREMENT · IN") only
- **Green bar spanning full width** — `maxVal` calculation refined to `Math.max(Math.ceil(correct) + 1, 4)` so the reference bar consistently occupies ~75–80% of the ruler width
- **Color mismatch (question mentions a color not visible)** — bar color is now extracted from `q.question` text as a regex fallback when `q.geometry.color` is absent

---

### Protractor Upgrade — Flipped Mode, Typed Answer & Multi-Mode — 2026-04-23

#### Changed — `ProtractorRenderer` (`src/screens/QuizScreen.js`)

**v1 — Removes the visual-matching shortcut**
- **Live readout hidden** — the `{angleDeg}°` number in the protractor center is no longer visible while the student is positioning; it only appears after submit
- **Typed answer required** — a `TextInput` now appears below the slider asking "What angle do you measure?" / "What angle is shown?"; correctness is judged on the typed value, not the slider position
- **Targeted diagnostic feedback** — wrong answers now detect the specific mistake:
  - Typed the supplement (e.g. 123 instead of 57) → *"You read from the wrong scale."*
  - Acute angle typed as obtuse → *"This is an acute angle — it must be less than 90°."*
  - Obtuse angle typed as acute → *"This is an obtuse angle — it must be greater than 90°."*
  - Right angle mismatch → *"This is a right angle — it should be exactly 90°."*

**v2 — Scale-choice step**
- Required first step when `geometry.scaleOrigin` is present: two buttons ("← Left side" / "Right side →") that must be answered before the slider unlocks
- Wrong choice shakes + explains which side the baseline ray lies on
- Green confirmation banner adapts its text per mode (`read` / `build` / `align`)

**v3 — Three protractor modes**
- `align` (default) — slider + reference arm; student positions arm then types the value
- `read` — no slider; angle drawn at fixed position; student reads and types only
- `build` — no reference arm; student drags to construct the stated angle; slider validates

**Flipped mode**
- `geometry.flipped: true` renders the protractor with baseline pointing LEFT (180°) instead of right (0°)
- All arm screen angles mirrored: reference arm at `180 - angleDeg`, movable arm at `180 - angleDeg`
- Degree labels reverse: position 30° shows "150°", position 150° shows "30°", etc.
- Dotted arc sweeps in correct direction between baseline and reference arm
- Ray label positions recomputed from `PROT_R + 32` (beyond arm tip) using actual screen angles — fixes the ray-letter-overlapping-arm bug
- `scaleOrigin: "left"` when flipped; scale-choice step now has genuine 50/50 left/right variety

#### Fixed — Slider stale closure (both `ProtractorRenderer` and `RulerRenderer`)
- `PanResponder.create()` runs once on mount; prior code closed over initial `feedback`/`sliderLocked` values, making the slider reject gestures after any state change (re-render, scale-choice, etc.)
- Fixed by adding mutable refs (`feedbackRef`, `sliderLockedRef`, `rulerFeedbackRef`) assigned on every render; PanResponder callbacks now read `.current` at gesture time

#### Changed — `generate-questions` Edge Function (`supabase/functions/generate-questions/index.ts`)
- `flipped` field added to angle geometry schema (`true` = baseline left, `false` = baseline right)
- AI instructed to use `flipped: true` on ~half of protractor questions for genuine orientation variety
- `scaleOrigin: "left"` paired with `flipped: true`; `scaleOrigin: "right"` only for obtuse normal-orientation angles
- Acute normal-orientation angles omit `scaleOrigin` entirely (scale-choice step not shown)
- Explicit ban on worksheet/question-number references in measurement question text: *"Measure the angle in question 1"* style questions now explicitly forbidden
- Three prompt examples updated: normal read, flipped read, build mode

---

### Curriculum Audit Framework (Phase 7.G) — 2026-04-22

#### Added — Planning reference (K–8 Question Types document)

- Generated a 3-page K–8 question-type reference covering all grade bands (1–3, 4–5, 6–8) across Math, ELA, Science, and Social Studies
- **Page 1** — 5-layer renderer framework (stimulus, interaction, validation, scan-to-schema, fallback); cross-grade interaction patterns; Grades 1–3 question types and priority gaps
- **Page 2** — Grades 4–5 question types; 8 renderer targets (`FractionModelRenderer`, `CoordinateGridRenderer`, `ChartRenderer`, `TableStimulus`, `TimelineRenderer`, `MapRenderer` v2, `StepCard`, `EvidenceHighlight`); likely scan surprises
- **Page 3** — Grades 6–8 question types; 8 backlog renderers (`AdvancedNumberLineRenderer`, `CoordinatePlaneRenderer`, `GraphRenderer`, `RatioTableRenderer`, `TransformRenderer`, `WorkspaceRenderer`, `VennRenderer`, `SourceCard`); validation rules by type; most likely scanning failure modes
- This document is the direct source for all roadmap tickets 7.G.0 – 7.G.22 and the 7.G Renderer Framework section
- Reference images saved as `ChatGPT Image Apr 22, 2026, 10_11_43 PM (1).png`, `(2).png`, `(3).png` in the workspace root

---

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
