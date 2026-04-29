# SnapStudy — Enhanced Tool Design Specs

This document is the single source of truth for every pre-built interactive tool in SnapStudy. Each tool is fully designed here before any code is written.

---

## The Tool Registry Contract

### How it works

Every Enhanced tool has three hard boundaries:

1. **The developer owns the schema.** The data fields the AI must extract are defined here, not invented by the AI. The AI fills in the blanks; it does not design the form.

2. **The developer owns the renderer.** The UI shell, interaction layer, and validation model are built and tested independently of AI. The tool works before any scan is attempted.

3. **Fallback is always available.** If the AI cannot confidently match a question to a tool schema, or if the tool is not yet built, the question is generated as a standard type (multiple choice, fill_in, etc.). No questions are lost.

### Classification flow (edge function)

```
For each question extracted from the scan:

  1. AI reads the question content and determines: does this require an interactive tool?
  2. If yes: which tool? (protractor / ruler / number_line / clock / etc.)
  3. Is that tool in the TOOL_REGISTRY (i.e. built and deployed)?
       YES → AI extracts ONLY the fields defined in that tool's schema
       NO  → AI generates as the best-fitting standard type
  4. Question saved with toolType + geometry (tool data) fields
```

### Rendering flow (QuizScreen)

```
For each question:
  if q.toolType is present and registered in TOOL_REGISTRY:
    → render with the pre-built tool component
  else:
    → render with the standard renderer (MC / fill_in / etc.)
```

---

## Tool Template

Every tool spec must answer these questions before the build starts:

```
### [Tool Name]

**Status:** Pending Mockup | In Design | Building | Done

**Description:** What the tool shows and how the student interacts with it.

**Grade range:** Which grades encounter this tool on worksheets.

**Interaction modes:** Named variants of this tool (e.g. read / build / align).

**AI schema:** The exact JSON fields the AI must extract.

**Validation model:** What "correct" means, tolerances, alternate answers.

**Fallback:** What standard question type to use if this tool is unavailable.

**Mockup:** Reference image or description provided by the designer.

**Build notes:** Any technical decisions, edge cases, or constraints.
```

---

## Tools

---

### 1. Protractor

**Status:** Done — shell built, AI schema wired, regen wired

**Description:**
A virtual protractor rendered on screen. The student interacts with it to measure or construct an angle. The tool draws its own angle stimulus (rays from a vertex) so no external image is needed — this is the key difference from the old approach.

**Grade range:** Grades 4–8 (geometry units)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read` | An angle is drawn at a fixed position. Student reads the scale and types the degree value. No dragging. |
| `build` | Student drags an arm to construct a stated angle (e.g. "Draw a 65° angle"). No reference arm shown. |
| `align` | **3-step flow.** Step 1: student sees only the angle (no protractor) and picks a rough estimate from 3 buttons. Step 2: full protractor appears with draggable arm — student aligns it. Step 3: student types the exact value and submits. Only step 3 is scored. |
| `estimate` | Angle stimulus only (no protractor). Student picks the closest degree value from 4 multiple-choice buttons. A motivational banner is shown below. |
| `spot_mistake` | Protractor is shown with a fixed angle. Two named characters (each with an avatar) claim different measurements. Student taps which character is right, or "They are both wrong." Tests scale-reading awareness. |

**AI schema:**
```json
{
  "toolType": "protractor",
  "geometry": {
    "type": "angle",
    "angleDeg": 68,
    "protractorMode": "read",
    "vertex": "M",
    "ray1": "N",
    "ray2": "L",
    "flipped": false
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `angleDeg` | number | Yes | The target angle in degrees (1–179) |
| `protractorMode` | string | Yes | `"read"`, `"build"`, `"align"`, `"estimate"`, or `"spot_mistake"` |
| `vertex` | string | No | Label for the vertex point (e.g. `"M"`) |
| `ray1` | string | No | Label for the first ray end (e.g. `"N"`) |
| `ray2` | string | No | Label for the second ray end (e.g. `"L"`) |
| `flipped` | boolean | No | `true` = baseline points left (180°); `false` = baseline points right (0°) |
| `claimA` | object | `spot_mistake` only | `{ "name": "Nina", "valueDeg": 70 }` — first character's claim |
| `claimB` | object | `spot_mistake` only | `{ "name": "Sam", "valueDeg": 110 }` — second character's claim |
| `correctClaim` | string | `spot_mistake` only | `"A"`, `"B"`, or `"neither"` |

**Avatar names** available for `spot_mistake` mode: `nina`, `sam`, `mia`, `leo`, `ava`, `max`
(name in `claimA.name` / `claimB.name` must match one of these, case-insensitive)

**Validation model:**
- `read` / `align` step 3: student's typed value is correct if within ±5° of `angleDeg`
- `build`: student's dragged position is correct if within ±5° of `angleDeg`
- `align` step 1 (estimate): not scored — any pick advances; pedagogical scaffolding only
- `estimate`: correct if student picks the multiple of 30 closest to `angleDeg`
- `spot_mistake`: correct if student picks the claim matching `correctClaim`
- Diagnostic feedback for common mistakes: wrong scale (supplement), acute/obtuse confusion, right angle off-by-one

**Fallback:** `fill_in` — "What is the measure of angle MNL?" with `correctAnswer: "68"`

**Mockup:** ✅ Received — see `ChatGPT Image Apr 22, 2026, 10_11_43 PM (1).png`

**Status:** Done — all 5 modes interactive, AI schema wired, regen wired.

**Build notes:**
- `ProtractorFace` is a shared display-only sub-component used by all modes
- `SliderRow` is extracted as a shared sub-component used by `read/build` and `align` step 2
- `align` step 1 estimate options are generated algorithmically (3 closest multiples of 30 to `angleDeg`)
- `estimate` mode options are generated algorithmically (4 closest multiples of 30 to `angleDeg`)
- Avatar images live in `assets/child-avatars/`; name lookup is case-insensitive
- `flipped: true` mirrors all screen angles and reverses the degree scale labels
- Scale-choice step (which 0° to read from) only shown for obtuse angles or flipped mode
- `enrichDrawAngleQuestions` (enrich.ts) auto-upgrades any plain `fill_in` "Draw a X° angle" that GPT forgets to tag with a `measurementTool`
- Regen fully wired: `REGEN_SYSTEM_PROMPT` documents all 5 modes; ScanScreen passes `protractorMode` context; edge function injects it into the user message so regen always returns a proper protractor question

---

### 2. Ruler

**Status:** Done — all 4 subtypes live, MC-based pedagogical redesign complete

**Description:**
A virtual ruler rendered in code (no image assets). A colored bar sits above the ruler scale. The interaction is fully multiple-choice — no smooth dragging — so the student must read the ruler, not match by feel. This eliminates "hot/cold" trial-and-error solving and requires real interval-counting and subtraction reasoning.

**Grade range:** Grades 1–6 (measurement units)

**Interaction modes / subtypes:**

| Subtype | What the student does | Grade |
|---|---|---|
| `endpoint` | Bar starts at 0. Static display + 4 MC buttons for the length. | 1–3 |
| `offset` | Bar starts at a non-zero position. Start value labeled. 4 MC buttons — distractors include the endpoint (most common mistake) and the start value. | 2–4 |
| `compare` | Two colored bars above the same ruler. 3-button tap: left / right / same. | 2–3 |
| `difference` | Two colored bars with a yellow bracket over the gap. 4 MC buttons — distractor includes the longer bar's full length. | 3–5 |

**AI schema:**
```json
{
  "type": "fill_in",
  "measurementTool": "ruler",
  "question": "How long is the blue bar?",
  "hint": "Start at 0 and count the tick marks.",
  "correctAnswer": "3.5",
  "rulerSubtype": "endpoint",
  "geometry": {
    "length": 3.5,
    "unit": "inch",
    "color": "blue",
    "rulerMax": 5,
    "start": 0
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `rulerSubtype` | string | `"endpoint"` \| `"offset"` \| `"compare"` \| `"difference"` |
| `geometry.length` | number | Correct length (or bar1 length for compare/difference) |
| `geometry.unit` | string | `"inch"` or `"cm"` |
| `geometry.color` | string | `"red"`, `"blue"`, `"green"`, `"orange"`, `"purple"`, `"yellow"` |
| `geometry.start` | number | `offset` mode: where the bar starts (e.g. `2.0`); omit for endpoint |
| `geometry.bar2` | object | `compare`/`difference` modes: `{ "length": 3, "color": "red" }` |
| `geometry.rulerMax` | number | Optional; renderer auto-calculates from length if omitted |

**Distractor strategy:**
- `endpoint`: ±1 tick on each side + whole-number trap (student reads the next whole mark)
- `offset`: endpoint value + start value + ±1 tick (all three real classroom mistakes)
- `difference`: longer bar's full length + ±1 tick on each side

**v2 Pedagogy upgrades (post-feedback):**
- **Tick-counting animation**: when the student taps an MC option, a yellow sweep marker moves from 0 → 1 → 2 → … → selected value before feedback is revealed. This replaces visual estimation with explicit interval reasoning.
- **Offset counting**: the sweep starts at `startVal` and counts the length intervals, reinforcing "count from the start mark, not from 0."
- **Difference counting**: sweep starts at the shorter bar's end and counts the gap.
- **Responsive width**: ruler fills 90% of screen width (capped at 360px) so the tool occupies the majority of the screen area.
- **Animated MC buttons**: each of the 4 options has a distinct color accent (purple/blue/teal/amber); spring scale animation on press gives tactile feedback.
- **"Explain Why" feedback**: correct feedback shows the counting sequence (e.g. "1 in → 2 in → 3 in → 3½ in ✓"); wrong feedback names the specific mistake ("You read where the bar ends, not its length. Count FROM the start mark.").

**Fallback:** `fill_in` — "How long is the blue bar?" with `correctAnswer: "3.5"`

**Mockup:** ✅ Received — see `measuringtools.png`. MC-based redesign complete.

**Build notes:**
- Bar-above-ruler layout: bar floats at `BAR_TOP=6`, dashed vertical drop-lines connect endpoints to ruler ticks
- No drag interaction in endpoint/offset/difference modes — entirely MC
- `compare` mode retains the 3-button choice (left / right / same) — already MC
- `EndpointMode`: static bar + 4 MC buttons; `endpointHint()` gives targeted per-wrong-answer feedback
- `OffsetMode`: badge shows start value; MC distractors include endpoint and start value with explanations; `offsetHint()` explains the subtraction
- `DifferenceMode`: yellow bracket highlights the gap; `diffHint()` explains longer − shorter = difference
- `inferRulerSubtype` preserves backward compat with questions stored before `rulerSubtype` was saved
- Styles fully self-contained in `rulerStyles` (no dependency on shared `measStyles`)

---

### 2b. Measuring Cup

**Status:** Done — all 3 modes live (read, fill, compare), AI schema wired, regen wired

**Description:**
A procedurally drawn measuring cup (pure React Native Views — no image assets). Tick marks at ¼, ½, ¾, and 1 cup are drawn on the right interior wall. Blue liquid fill, optional yellow target line (fill mode), and a pour spout + handle complete the visual. Three interaction modes cover reading a level, calculating how much more to add, and comparing two cups. All modes use 4-button multiple choice — no dragging.

**Grade range:** Grades 1–4 (liquid measurement units)

**Interaction modes:**

| Mode | What the student does | Grade |
|---|---|---|
| `read` | Cup shown at a level. Student picks the correct volume from 4 MC options. | 1–3 |
| `fill` | Cup shown partially filled; yellow line marks the target. Student picks how much MORE to add. Distractors include the target level and the current level. | 2–4 |
| `compare` | Two cups shown side by side. 3-button choice: left / right / same. | 1–3 |

**AI schema:**

*read:*
```json
{
  "type": "fill_in",
  "measurementTool": "measuring_cup",
  "question": "How much liquid is in the cup?",
  "hint": "Find the line the top of the liquid touches.",
  "correctAnswer": "½ cup",
  "geometry": { "mode": "read", "level": 0.5, "unit": "cup" }
}
```

*fill:*
```json
{
  "type": "fill_in",
  "measurementTool": "measuring_cup",
  "question": "How much more do you need to add to reach the yellow line?",
  "hint": "Subtract the current amount from the target.",
  "correctAnswer": "½ cup",
  "geometry": { "mode": "fill", "currentLevel": 0.25, "targetLevel": 0.75, "unit": "cup" }
}
```

*compare:*
```json
{
  "type": "fill_in",
  "measurementTool": "measuring_cup",
  "question": "Which cup has more liquid?",
  "hint": "Compare where the liquid reaches in each cup.",
  "correctAnswer": "left",
  "geometry": { "mode": "compare", "level": 0.75, "level2": 0.5, "unit": "cup" }
}
```

| Field | Type | Notes |
|---|---|---|
| `geometry.mode` | string | `"read"` \| `"fill"` \| `"compare"` |
| `geometry.level` | number | One of `0.25`, `0.5`, `0.75`, `1.0` |
| `geometry.targetLevel` | number | `fill` mode: target (must be > `currentLevel`) |
| `geometry.currentLevel` | number | `fill` mode: starting fill level |
| `geometry.level2` | number | `compare` mode: second cup level |
| `geometry.unit` | string | Always `"cup"` for now |
| `correctAnswer` | string | Fraction label: `"¼ cup"`, `"½ cup"`, `"¾ cup"`, `"1 cup"` · or `"left"/"right"/"equal"` for compare |

**Distractor strategy:**
- `read`: other 3 clean tick levels shuffled (all nearby)
- `fill`: target level + current level + 1 random other level (both real student mistakes)
- `compare`: no distractors — 3 fixed buttons: left / right / same

**Fallback:** `fill_in` — "How much liquid is in the cup?" with `correctAnswer: "½ cup"`

**Mockup:** ✅ Received — see `measuringtools.png`. Procedural cup design complete.

**Build notes:**
- Cup body: `80 × 132` px interior; `3px` border wall; `borderRadius: 4`; dark background `#0f172a`
- Liquid fill: `position: absolute; bottom: 0` with height proportional to level; color `#60a5fa` (blue)
- Target line: `2.5px` yellow (`#fbbf24`) horizontal bar at `targetLevel * CUP_INNER_H` from bottom
- Tick marks: `10 × 1.5px` marks on right interior wall at 25% / 50% / 75% / 100% heights
- Tick labels: positioned absolutely to the right of the cup body at matching heights
- Handle: right-side arc using `borderTopRightRadius / borderBottomRightRadius` with no left border
- Pour spout: `8 × 7px` solid rectangle at top-left of cup
- `TICK_LEVELS` array drives both the visual tick marks and the MC option generation
- `levelToAnswer(level)` converts `0.5` → `"½ cup"` etc. for answer comparison
- `buildFillOptions` includes target level and current level as explicit distractors (real student mistakes)

---

### 3. Number Line

**Status:** Done — 5 modes live (read, place, missing, partition, distance)

**Design principle:** Number lines teach magnitude, intervals, fractions, and estimation — NOT "drag dot until green." Every mode uses staged thinking: student acts first, then taps "Check Answer". No live value readout while dragging.

**Description:**
A responsive, touch-friendly number line drawn in SVG. Thick line (3px), large tick marks with grade-appropriate spacing, snap-to-interval placement. Color coding: negative values get red-tinted zone, student point is purple → green/red on feedback. Two points in distance mode are color-coded. No live value feedback during placement.

**Grade range:** Grades 1–8 (primary: 1–5)

**Interaction modes (Priority 1–5):**

| # | Mode | What the student does | Educational value |
|---|---|---|---|
| 1 | `read` | A pre-placed colored dot is shown. Student picks its value from 4 MC options. | Interval counting, magnitude reasoning |
| 2 | `place` | Student drags/taps to place a point; snaps to nearest tick only. Submit button required — no live readout while placing. | Equal spacing, count-to-place |
| 3 | `missing` | A sequence is shown with one value hidden behind "?". Student picks the missing value from 4 MC options. | Skip counting, pattern recognition |
| 4 | `partition` | Unlabeled number line (0 and max only). Student counts equal parts and picks from 4 MC options. | Fraction partitioning — CRITICAL for fraction understanding |
| 5 | `distance` | Two labeled colored points (A and B) are shown. Student picks how far apart they are from MC. | Subtraction, absolute value, interval counting |

**AI schema — `type: "number_line"` for all 5 modes:**

*Mode 1 — read:*
```json
{
  "type": "number_line", "mode": "read",
  "question": "What number is shown by the point?",
  "hint": "Count the spaces between tick marks from 0.",
  "options": ["2.5", "2.8", "3", "3.2"],
  "correctIndex": 2, "correctAnswer": "3",
  "geometry": { "min": 0, "max": 6, "step": 1, "target": 3, "pointColor": "purple" }
}
```

*Mode 2 — place (default, mode field optional):*
```json
{
  "type": "number_line",
  "question": "Place the point at 3½.",
  "hint": "Count 3 whole numbers, then one half step.",
  "correctAnswer": "3.5",
  "geometry": { "min": 0, "max": 6, "step": 0.5, "target": 3.5 }
}
```

*Mode 3 — missing:*
```json
{
  "type": "number_line", "mode": "missing",
  "question": "What number is missing from the pattern?",
  "hint": "Find the pattern — count the spaces between the numbers you can see.",
  "options": ["8", "10", "12", "14"],
  "correctIndex": 1, "correctAnswer": "10",
  "geometry": { "min": 0, "max": 20, "step": 5, "missingValue": 10 }
}
```

*Mode 4 — partition:*
```json
{
  "type": "number_line", "mode": "partition",
  "question": "How many equal parts is the number line divided into?",
  "hint": "Count the spaces between tick marks, not the marks themselves.",
  "options": ["2", "3", "4", "5"],
  "correctIndex": 2, "correctAnswer": "4",
  "geometry": { "min": 0, "max": 1, "step": 0.25 }
}
```

*Mode 5 — distance:*
```json
{
  "type": "number_line", "mode": "distance",
  "question": "How far apart are points A and B?",
  "hint": "Count the spaces between the two points.",
  "options": ["4 units", "5 units", "6 units", "7 units"],
  "correctIndex": 1, "correctAnswer": "5",
  "geometry": {
    "min": 0, "max": 8, "step": 1,
    "points": [
      { "value": 2, "label": "A", "color": "green" },
      { "value": 7, "label": "B", "color": "blue" }
    ]
  }
}
```

**Field reference:**

| Field | Modes | Type | Notes |
|---|---|---|---|
| `mode` | all | string | `"read"`, `"missing"`, `"partition"`, `"distance"`, or omit for `place` |
| `geometry.min` | all | number | Left end of line |
| `geometry.max` | all | number | Right end of line |
| `geometry.step` | all | number | Interval between ticks (2–20 ticks total) |
| `geometry.target` | read, place | number | Where the dot is / where to place |
| `geometry.pointColor` | read | string | `purple` (default), `blue`, `green`, `orange`, `red`, `yellow` |
| `geometry.missingValue` | missing | number | The hidden value; must land exactly on a tick |
| `geometry.points` | distance | array | `[{value, label, color}, ...]` — exactly 2 points |
| `options` | read, missing, partition, distance | string[] | 4 MC choices |
| `correctIndex` | read, missing, partition, distance | number | 0–3 |

**Fallback:** `fill_in` for place; `multiple_choice` for read/missing/partition/distance.

**Build notes:**
- Canvas width is responsive: `min(screenWidth − 40, 360)` — not a fixed 280px
- Negative number support: values left of zero get a red-tinted background zone
- Partition mode hides all tick labels except 0 and max — student must count intervals
- Missing mode replaces the missing tick label with a "?" badge (blue circle)
- Distance mode draws a bracket/brace between the two labeled points
- Submit button is always required for place mode — no auto-advance on snap
- Backward compatible: old `"mode": "count"` falls through to partition renderer

---

### 4. Analog Clock

**Status:** Done — all 4 modes live, AI schema wired, regen wired

**Description:**
A procedurally drawn analog clock face (no image assets — pure React Native Views). Four interactive modes: read a fixed clock time, set hands via sliders to show a target time, estimate the approximate time from MC options, or spot which of two characters read the clock correctly.

**Grade range:** Grades 1–3

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read` | Clock shows a fixed time. Student types the time (H:MM format) in a TextInput. |
| `set` | A digital target time is shown. Student uses two sliders (Hour + Minute) to move the clock hands to match. |
| `estimate` | Clock shown at an "unclean" time (e.g. 8:47). Student picks the closest time from 4 auto-generated MC buttons. |
| `spot_mistake` | Clock shown with a fixed time. Two named characters claim different times. Student taps the correct one (or "They are both wrong"). |

**AI schema:**
```json
{
  "type": "fill_in",
  "measurementTool": "clock",
  "question": "What time does the clock show?",
  "hint": "Look at the short hand for the hour and the long hand for the minutes.",
  "correctAnswer": "3:15",
  "acceptedAnswers": ["3:15"],
  "geometry": {
    "hours": 3,
    "minutes": 15,
    "clockMode": "read"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `hours` | number | Yes | Hour value 1–12 |
| `minutes` | number | Yes | Minute value 0–59 |
| `clockMode` | string | Yes | `"read"`, `"set"`, `"estimate"`, or `"spot_mistake"` |
| `claimA` | object | `spot_mistake` only | `{ "name": "Nina", "time": "6:15" }` |
| `claimB` | object | `spot_mistake` only | `{ "name": "Sam", "time": "6:45" }` |
| `correctClaim` | string | `spot_mistake` only | `"A"`, `"B"`, or `"neither"` |

**Avatar names** available for `spot_mistake`: `nina`, `sam`, `mia`, `leo`, `ava`, `max`

**Validation model:**
- `read`: typed value normalised to `H:MM`, exact match against `correctAnswer`
- `set`: current slider position must match `hours` (mod 12) and `minutes` (exact, 5-min steps)
- `estimate`: client generates 4 options at 15-min boundaries; correct = closest to actual time
- `spot_mistake`: student's tapped claim must match `correctClaim`

**Fallback:** `multiple_choice` — "What time does the clock show?" with 4 nearby times as options

**Mockup:** ✅ Received — see workspace assets folder (`ClockUImockup-…png`)

**Build notes:**
- Clock face drawn entirely in code (circle + number labels + armStyle hands + center dot)
- `armStyle` helper from `measurementHelpers.js` draws both clock hands using the midpoint-rotation trick
- Hour hand: purple (`#7c3aed`), 52px, thickness 6; Minute hand: green (`#4ade80`), 76px, thickness 3
- `set` mode uses two separate `useClockSlider` hooks (same stale-closure-safe PanResponder pattern as Protractor)
  - Hour slider: 12 steps → values 1–12
  - Minute slider: 12 steps → values 0, 5, 10 … 55 (5-minute intervals)
- `estimate` options generated client-side via `buildEstimateOptions(hours, minutes)` — AI does not provide options
- Avatar images shared with ProtractorRenderer: `assets/child-avatars/{name}_avatar.png`

---

### 5. Coin / Money

**Status:** Done — all 5 modes live, AI schema wired, regen wired

**Description:**
Displays labeled currency images — coins (penny, nickel, dime, quarter) and bills ($1, $5, $10). Depending on the mode, the student counts a displayed set of coins and/or bills, taps currency from a pool to make an exact amount, estimates a total from MC options, spots a counting mistake, or builds an amount using the fewest pieces possible. Currency assets live in `assets/tool-icons/`. For totals ≥ $1.00 the count-mode input shows a `$` prefix with decimal-pad keyboard; for totals under $1.00 it shows a `¢` suffix with number-pad.

**Grade range:** Grades 1–3

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `count` | A set of coins is displayed. Student types the total value. |
| `make` | Target amount shown. Student taps coins from a pool to reach the exact total. |
| `estimation` | Coins displayed. Student picks the closest amount from 4 auto-generated MC options. |
| `spot_mistake` | Coins displayed. Two characters each claim a different total. Student taps the correct one. |
| `fewest` | Target shown. Student selects coins to reach the total using the minimum number of coins. |

**AI schema** (uses `measurementTool: "coin"` on a `fill_in` question):
```json
{
  "type": "fill_in",
  "measurementTool": "coin",
  "question": "How much money is shown?",
  "hint": "Count each coin carefully.",
  "correctAnswer": "80",
  "acceptedAnswers": ["80¢", "0.80", "$0.80", "80 cents"],
  "geometry": {
    "mode": "count",
    "coins": [
      { "denomination": "quarter", "count": 2 },
      { "denomination": "dime", "count": 3 }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `geometry.mode` | string | Yes | `"count"`, `"make"`, `"estimation"`, `"spot_mistake"`, `"fewest"` |
| `geometry.coins` | array | `count`, `estimation`, `spot_mistake` | `[{ denomination, count }]` — denominations: penny/nickel/dime/quarter/dollar/five_dollar/ten_dollar |
| `geometry.target` | number | `make`, `fewest` | Amount in cents (integer) |
| `geometry.availableCoins` | string[] | No | Pool for make/fewest modes. Defaults to `[quarter, dime, nickel, penny]` |
| `geometry.claimA` / `claimB` | object | `spot_mistake` | `{ name: string, valueCents: number }` |
| `geometry.correctClaim` | string | `spot_mistake` | `"A"` or `"B"` |
| `correctAnswer` | string | Yes | Cents as string for most modes; `"A"`/`"B"` for spot_mistake; min coin count for fewest |

**Avatar names** available for `spot_mistake`: `nina`, `sam`, `mia`, `leo`, `ava`, `max`

**Validation model:**
- `count`: for totals < $1.00 — strip non-digits, compare as integer cents. For totals ≥ $1.00 — accept dollar format (`1.35` → `Math.round(float × 100)`) or bare cents (`135`) as fallback
- `make`: wallet total must equal target cents
- `estimation`: app generates 4 MC options bracketing the actual total (rounded to nearest 5¢); correct = matching option
- `spot_mistake`: student picks A or B matching `correctClaim`
- `fewest`: wallet total must equal target AND coin count must be ≤ `correctAnswer` (minimum)

**Fallback:** `fill_in` — "How much money is shown?" with `correctAnswer` in cents

**Mockup:** ✅ Reference image provided — see workspace assets folder.

**Build notes:**
- Currency PNG assets: `assets/tool-icons/penny_icon.png`, `nickel_icon.png`, `dime_icon.png`, `quarter_icon.png`, `onedollar_icon.png`, `fivedollar_icon.png`, `tendollar_icon.png`
- Avatar assets shared with ProtractorRenderer: `assets/child-avatars/{name}_avatar.png`
- `WalletSummary` groups coins by denomination with a count badge (avoids rendering 8 individual penny images)
- `make` and `fewest` modes accept an `availableCoins` array on the geometry to include bills; defaults to `[quarter, dime, nickel, penny]`
- `make` mode allows going over the target (shows red warning); Check validates total
- `fewest` mode disables coins that would exceed the target; validates both amount AND count
- Estimation MC options generated client-side via `buildEstimationOptions(actualCents)` — AI does not provide options
- Count-mode input is dual-mode: `¢` suffix + number-pad for totals < 100¢; `$` prefix + decimal-pad for totals ≥ $1.00

---

### 6. Coordinate Grid

**Status:** Pending Mockup

**Description:**
A labeled coordinate grid. Student plots a point by tapping, reads the coordinates of a marked point, or identifies a shape on the grid.

**Grade range:** Grades 4–8

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read` | A point is pre-plotted. Student identifies its coordinates. |
| `plot` | Student taps the grid to place a point at a stated coordinate. |

**AI schema:**
```json
{
  "toolType": "coordinate_grid",
  "geometry": {
    "mode": "read",
    "points": [{ "x": 3, "y": 4, "label": "A" }],
    "quadrants": 1,
    "gridMax": 6
  }
}
```

**Fallback:** `fill_in` — "What are the coordinates of point A?" with `correctAnswer: "(3, 4)"`

**Mockup:** *Waiting for designer mockup.*

---

### 7. Fraction Bar

**Status:** Built — 4 modes live (`read`, `shade`, `compare`, `equivalent`)

**Description:**
A horizontal segmented bar split into equal parts. Supports four interaction modes covering fraction reading, shading, comparison, and equivalent-fraction building. In `read` mode a pre-shaded bar is shown and the student picks the correct fraction from auto-generated MC options that deliberately mix same-denominator and cross-denominator distractors to prevent guessing. In `shade` mode the student taps segments to build a target fraction. In `compare` mode two bars are shown side-by-side and the student judges which fraction is larger (or if equal). In `equivalent` mode a static reference bar anchors a target fraction and the student shades a second bar with a different number of parts to show the same value.

**Grade range:** Grades 3–5

**Interaction modes:**

| Mode | What the student does | Grades |
|---|---|---|
| `read` | Pre-shaded bar; pick the correct fraction from 4 MC options (cross-denom distractors included) | 3–4 |
| `shade` | Target fraction shown as badge; tap segments to shade, then Check | 3–4 |
| `compare` | Two bars displayed; decide which fraction is greater, or if they're equal | 4–5 |
| `equivalent` | Static reference bar; shade a second bar (different denominator) to show the same value | 4–5 |

**AI schema** (`measurementTool: "fraction_bar"` on a `fill_in` question):

*read / shade:*
```json
{
  "type": "fill_in", "measurementTool": "fraction_bar",
  "question": "What fraction of the bar is shaded?",
  "hint": "Count the shaded parts, then count all the equal parts.",
  "correctAnswer": "3/4",
  "geometry": { "mode": "read", "parts": 4, "shaded": 3 }
}
```

*compare:*
```json
{
  "type": "fill_in", "measurementTool": "fraction_bar",
  "question": "Which fraction is greater?",
  "hint": "Convert to decimals to compare.",
  "correctAnswer": "top",
  "geometry": { "mode": "compare", "parts": 4, "shaded": 3, "parts2": 3, "shaded2": 2 }
}
```

*equivalent:*
```json
{
  "type": "fill_in", "measurementTool": "fraction_bar",
  "question": "Shade the bottom bar to show the same fraction as the top bar.",
  "hint": "1/2 means half — how many of 4 parts equal half?",
  "correctAnswer": "2",
  "geometry": { "mode": "equivalent", "parts": 2, "shaded": 1, "parts2": 4 }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `geometry.mode` | string | Yes | `"read"` \| `"shade"` \| `"compare"` \| `"equivalent"` |
| `geometry.parts` | number | Yes | Denominator of primary bar (2–10) |
| `geometry.shaded` | number | Yes | Numerator of primary bar; must be ≥ 1 and < parts |
| `geometry.parts2` | number | compare/equivalent | Denominator of second bar |
| `geometry.shaded2` | number | compare only | Numerator of second bar |
| `correctAnswer` | string | Yes | Fraction `"N/D"` (read) · shaded count (shade/equivalent) · `"top"\|"bottom"\|"equal"` (compare) |

**Validation model:**
- `read`: client builds 4 MC options with `buildReadOptions(parts, shaded)` — 1 cross-denom distractor + 1 same-denom distractor + 1 common-fraction fallback; correct = `shaded/parts`
- `shade`: correct if `tapped.size === geometry.shaded` (any segment combination accepted)
- `compare`: correct answer computed client-side (`shaded/parts` vs `shaded2/parts2`); AI `correctAnswer` is used as a secondary check
- `equivalent`: target = `Math.round((shaded/parts) × parts2)`; correct if `tapped.size === target`

**Fallback:** `multiple_choice` — "What fraction of the bar is shaded?"

**Mockup:** *Waiting for designer mockup.*

**Build notes:**
- Bar rendered as `flexDirection:'row'` with `flex:1` segments; first/last get corner radius; gap via `marginLeft/marginRight: SEG_GAP/2`
- `compare` mode uses per-bar color theming (blue top / pink bottom) so students can tell them apart
- `equivalent` uses a vertical "=" connector between the two bars; live fraction label on the interactive bar updates as segments are tapped
- MC options in `read` mode rendered as stacked fraction notation (numerator / line / denominator) not plain text
- Segment colors: unshaded `#1e293b`, shaded `#4ade80` (green), compare-top `#60a5fa` (blue), compare-bottom `#f472b6` (pink); correct feedback `#22c55e`, wrong `#ef4444`

---

### 8. Bar / Line Chart (Chart Reader)

**Status:** Pending Mockup

**Description:**
A rendered bar chart or line graph built entirely from AI-extracted data. The student reads a specific value, compares bars, or identifies a trend. No external image required — the chart is drawn from the `labels` and `values` arrays the AI extracts from the page. Applicable to Math (data and graphing units), Science (experiment results, weather data, population data), and Social Studies (population charts, historical data).

**Grade range:** Grades 3–8

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read_value` | A specific bar or data point is highlighted. Student types or selects its value. |
| `compare` | Student identifies the highest bar, lowest bar, or the difference between two named bars. |
| `trend` | Line chart shown. Student picks the correct description of the trend (increasing / decreasing / stays the same). |

**AI schema:**
```json
{
  "toolType": "chart",
  "geometry": {
    "chartType": "bar",
    "labels": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "values": [4, 7, 3, 8, 5],
    "yLabel": "Books Read",
    "xLabel": "Day of Week",
    "mode": "read_value",
    "targetLabel": "Wed",
    "unit": "books"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `chartType` | string | Yes | `"bar"` or `"line"` |
| `labels` | string[] | Yes | Category labels (x-axis) |
| `values` | number[] | Yes | Data values (must match length of `labels`) |
| `yLabel` | string | No | Y-axis label |
| `xLabel` | string | No | X-axis label |
| `mode` | string | Yes | `"read_value"`, `"compare"`, or `"trend"` |
| `targetLabel` | string | `read_value` only | Which bar / point the question asks about |
| `unit` | string | No | Unit suffix for display (e.g. `"°F"`, `"students"`) |

**Validation model:**
- `read_value`: correct answer is `values[labels.indexOf(targetLabel)]`; accept ± 0 (exact)
- `compare`: AI sets `correctAnswer` to the label or difference value; rendered as MC
- `trend`: rendered as 3-option MC (increasing / decreasing / no change); AI sets `correctAnswer`

**Fallback:** `multiple_choice` — question rephrased around the chart data.

**Mockup:** *Waiting for designer mockup.*

**Build notes:**
- Chart drawn using React Native `View` flex bars (bar chart) or SVG path (line chart); no third-party charting library
- Bar chart: bars are proportional to `max(values)`; target bar highlighted in accent color
- Line chart: points connected with straight segments; dots at each data point
- Grid lines at 25% / 50% / 75% / 100% of max value for readability

---

### 9. Timeline Builder

**Status:** Pending Mockup

**Description:**
A horizontal timeline with labeled event slots. The AI extracts events and their dates or sequence positions from the scanned page. In `order` mode, event cards are presented in a shuffled chip bank; the student taps each card and places it on the correct numbered slot on the timeline. In `read` mode, a completed timeline is displayed and the student answers a specific question about it (e.g. "Which event happened first?"). Applicable to Social Studies (history sequences), Science (lifecycle steps, scientific method), and Reading (plot sequence for biography units).

**Grade range:** Grades 3–8

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `order` | Event chips shuffled in a bank below. Student taps a chip then taps its correct slot on the timeline. |
| `read` | Pre-built timeline displayed. Student answers a MC or fill_in question about a specific event. |

**AI schema:**
```json
{
  "toolType": "timeline",
  "geometry": {
    "mode": "order",
    "events": [
      { "label": "Declaration of Independence", "year": 1776, "correctIndex": 0 },
      { "label": "Constitution signed", "year": 1787, "correctIndex": 1 },
      { "label": "Bill of Rights ratified", "year": 1791, "correctIndex": 2 }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | string | Yes | `"order"` or `"read"` |
| `events` | array | Yes | Array of event objects |
| `events[].label` | string | Yes | Short event description (keep under 50 chars) |
| `events[].year` | number \| null | No | Year or numeric date; `null` for non-dated sequences |
| `events[].correctIndex` | number | `order` mode | 0-based position in the correct sequence |

**Validation model:**
- `order`: all events must be placed in slots matching `correctIndex`; partial credit feedback on Check
- `read`: answered via the standard MC / fill_in answer layer on top of the timeline display

**Fallback:** `ordering` — event labels as chips to sequence.

**Mockup:** *Waiting for designer mockup.*

**Build notes:**
- Timeline rendered as a horizontal `ScrollView` (for 5+ events) or fixed row (3–4 events)
- Each slot shows a numbered circle + empty label area; filled slots show the event card in accent color
- Chip bank below the timeline; chips removed from bank when placed; tap a placed chip to return it
- `year` field is optional — for non-dated sequences (scientific method steps, story plot) omit it and slots are labeled 1, 2, 3…
- Maximum recommended events: 8 (above this, `ordering` fallback is preferred)

---

---

## Tier 3 — Fraction Learning System Expansion (Specced, Not Yet Built)

The tools below extend the Fraction Bar into a complete fraction strand. They share the same `measurementTool` field convention and the same renderer dispatch in `QuizScreen.js`.

---

### T3-A. Fraction Number Line

**Status:** Built — 3 modes live (`read`, `place`, `order`)

**Description:**
A number-line ruler from 0 to 1 (or 0 to 2 for mixed-number practice). A draggable point or a set of tick-mark labels asks the student to place a fraction at the correct position, or identify a fraction shown at a marked position.

**Grade range:** Grades 3–5

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `place` | Student drags a point to the correct position on the line |
| `read` | A point is placed; student picks the correct fraction from 4 MC options |
| `order` | 3–4 fraction chips are placed; student drags them into ascending order |

**AI schema:**
```json
{
  "type": "fill_in",
  "measurementTool": "fraction_number_line",
  "question": "Place 3/4 on the number line.",
  "correctAnswer": "0.75",
  "geometry": {
    "mode": "place",
    "min": 0, "max": 1,
    "denominator": 4,
    "target": 3
  }
}
```

**Validation model:**
- `place`: student's drag position within ±(0.5/denominator) of target decimal is correct
- `read`: auto-generated MC options at same-denominator neighbors + cross-denominator distractors (mirrors Fraction Bar read mode)
- `order`: correct if all chips sorted ascending by decimal value

**Build notes:**
- Render as a horizontal `View` with tick marks at each `1/denominator` interval
- Draggable point uses `PanResponder` or `react-native-gesture-handler`; snaps to nearest tick
- Tick labels shown below line; fraction label above draggable point updates live as it moves

---

### T3-B. Build-a-Fraction (Dynamic Partitioning)

**Status:** Built — `build` mode live

**Description:**
A blank bar (or circle) with no partitions. The student first sets the total number of parts by tapping +/− buttons (denominator), then taps segments to shade (numerator). This inverts the fraction bar workflow — the student must construct both the denominator and the numerator.

**Grade range:** Grades 4–5

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `build` | Given a target fraction, set total parts and shade the correct count |
| `free_build` | No target — student builds any fraction; question asks them to name it afterwards |

**AI schema:**
```json
{
  "type": "fill_in",
  "measurementTool": "fraction_build",
  "question": "Build the fraction 2/5 using the bar below.",
  "hint": "Set the bar to 5 equal parts, then shade 2.",
  "correctAnswer": "2/5",
  "geometry": {
    "mode": "build",
    "target": "2/5"
  }
}
```

**Validation model:**
- `build`: correct if `tapped.size === numerator` AND `parts === denominator`
- `free_build`: student types their answer; accepted if matches any reduced form or equivalent fraction

**Build notes:**
- Parts picker: stepper component (−/+ buttons) capped at 2–12
- Bar re-renders when parts change; tapped set resets when denominator changes
- Color: same palette as Fraction Bar; stacked fraction label badge updates live

---

### T3-C. Mixed Representation Match

**Status:** Specced — Not Built

**Description:**
Three representations of the same fraction — a fraction bar, a number-line point, and a fraction notation label — are shown out of sync. The student matches them or identifies the odd one out.

**Grade range:** Grades 4–6

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `match` | Three cards shown; student taps them in matched groups |
| `odd_one_out` | One card shows a different fraction; student finds the impostor |

**AI schema:**
```json
{
  "type": "fill_in",
  "measurementTool": "fraction_match",
  "question": "Which of these does NOT show 3/4?",
  "correctAnswer": "C",
  "geometry": {
    "mode": "odd_one_out",
    "target": "3/4",
    "cards": [
      { "id": "A", "type": "bar",    "parts": 4, "shaded": 3 },
      { "id": "B", "type": "label",  "value": "3/4" },
      { "id": "C", "type": "bar",    "parts": 4, "shaded": 1 }
    ]
  }
}
```

**Validation model:** `correctAnswer` is the card `id` of the odd-one-out.

---

### T3-D. Improper Fractions & Mixed Numbers

**Status:** Specced — Not Built

**Description:**
Extends the Fraction Bar to values > 1 by rendering multiple bars side-by-side (e.g., two bars of 3 parts each = 7/3 = 2⅓). Supports converting between improper fractions and mixed numbers.

**Grade range:** Grades 5–6

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read_improper` | Multi-bar shown; student identifies the improper fraction |
| `convert` | An improper fraction given; student shades bars to match, or types the mixed number |

**AI schema:**
```json
{
  "type": "fill_in",
  "measurementTool": "fraction_improper",
  "question": "What improper fraction is shown?",
  "correctAnswer": "7/3",
  "geometry": {
    "mode": "read_improper",
    "parts": 3,
    "bars": 2,
    "shadedInLast": 1
  }
}
```

**Validation model:** correct if student's input equals `correctAnswer` or any equivalent form.

---

### T3-E. Decimal ↔ Fraction Bridge

**Status:** Specced — Not Built

**Description:**
Shows a fraction bar with a shaded region. Below it, a decimal display reads "0.___". Student drags a slider or taps to set the decimal value that matches the fraction, or vice versa.

**Grade range:** Grades 5–6

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `fraction_to_decimal` | Fraction bar shown; student enters or selects the decimal |
| `decimal_to_fraction` | Decimal shown on a number strip; student sets bar shading to match |

**AI schema:**
```json
{
  "type": "fill_in",
  "measurementTool": "fraction_decimal_bridge",
  "question": "What decimal does the bar show?",
  "correctAnswer": "0.75",
  "geometry": {
    "mode": "fraction_to_decimal",
    "parts": 4,
    "shaded": 3
  }
}
```

**Validation model:** accepted if `Math.abs(parseFloat(studentAnswer) - correctValue) < 0.005`.

---

---

## Science, Reading & Social Studies Tools

These tools extend the Enhanced Tool Framework beyond Math. They follow the same contract as Math tools: the developer pre-builds the renderer, the AI extracts data into a fixed schema, and a standard fallback is always available.

---

### S1. Classification Sort

**Status:** Specced — Pending Mockup

**Description:**
Two or three labeled columns (buckets). A bank of word or phrase chips below. The student taps a chip and then taps the correct bucket to place it. Covers the most common sorting/categorization concept across all subjects: living vs. non-living, needs vs. wants, fact vs. opinion, solid/liquid/gas, vertebrate/invertebrate, legislative/executive/judicial, and more.

**Grade range:** Grades 2–6 (Science, Social Studies, Reading, Math)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `two_way` | Two labeled buckets; all chips must be placed |
| `three_way` | Three labeled buckets; all chips must be placed |

**AI schema:**
```json
{
  "toolType": "classification_sort",
  "geometry": {
    "mode": "two_way",
    "categories": [
      { "label": "Living", "color": "green" },
      { "label": "Non-Living", "color": "blue" }
    ],
    "items": [
      { "text": "Dog", "correctCategory": "Living" },
      { "text": "Rock", "correctCategory": "Non-Living" },
      { "text": "Tree", "correctCategory": "Living" },
      { "text": "Water", "correctCategory": "Non-Living" }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | string | Yes | `"two_way"` or `"three_way"` |
| `categories` | array | Yes | 2 or 3 objects with `label` and `color` (`"green"`, `"blue"`, `"orange"`) |
| `items` | array | Yes | 4–8 chips; each has `text` and `correctCategory` matching a `categories.label` |

**Validation model:**
- All items must be placed in their `correctCategory` bucket
- Check button validates on submission; incorrect items are returned to the chip bank with shake animation
- `correctAnswer` field not used — validation is purely derived from `items[].correctCategory`

**Fallback:** `ordering` (for 2-way) or `multiple_choice` per item.

**Mockup:** *Pending.*

**Build notes:**
- Chip bank sits below the two/three column layout
- Tap chip → chip highlights → tap target bucket → chip snaps into bucket with color feedback
- Tapping a placed chip returns it to the chip bank
- Category column headers use the `color` field for a top border accent (not background)
- Items should be kept short (under 25 chars) to fit in chip UI

---

### S2. Cause & Effect Mapper

**Status:** Specced — Pending Mockup

**Description:**
Two columns: **Cause** and **Effect**. A set of chips in each column is shuffled. The student taps a cause chip, then taps its matching effect chip to form a pair. Correct pairs lock together with a connector line. Interaction pattern is identical to `AngleMatchingRenderer` — this is a low-lift build using the same two-column matching architecture.

**Grade range:** Grades 2–6 (Reading, Science, Social Studies)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `match` | Tap a cause → tap its matching effect → pair locks |

**AI schema:**
```json
{
  "toolType": "cause_effect_map",
  "geometry": {
    "pairs": [
      { "cause": "Too much rain", "effect": "Flooding" },
      { "cause": "No rain for weeks", "effect": "Drought" },
      { "cause": "Strong winds", "effect": "Trees fall down" }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `pairs` | array | Yes | 2–4 pairs; each has `cause` (string) and `effect` (string) |

**Validation model:**
- Each pair is correct when the student connects the right cause to the right effect
- Completed pairs shown with a green connector; incorrect pairings shake and reset
- `correctAnswer` not used — derived from pair matching

**Fallback:** `matching` via `ordering` or two-column `word_bank`.

**Mockup:** *Pending.*

**Build notes:**
- Adapts the two-column chip selection pattern from `AngleMatchingRenderer.js`
- Left column: shuffled cause chips. Right column: shuffled effect chips.
- Tap state: first tap selects a cause (highlighted), second tap on an effect attempts a match
- 2–4 pairs recommended; above 4, the screen becomes cramped on small devices

---

### S3. Diagram Labeler

**Status:** Specced — Pending Mockup

**Description:**
An image with numbered or lettered pin markers overlaid at specific positions (specified as percentage coordinates). The student taps a pin, a word bank appears, and they select the correct label for that pin. Core use case: science diagrams (plant cell, water cycle, rock layers, human body, solar system, animal anatomy). Can also handle social studies maps when used with the `map` variant.

**Grade range:** Grades 3–8 (Science primarily)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `label` | Tap a pin → word bank appears → select the correct label |
| `identify` | All pins pre-labeled; one label is missing → student selects from MC options |

**AI schema:**
```json
{
  "toolType": "diagram_label",
  "geometry": {
    "mode": "label",
    "imageUrl": "https://...",
    "pins": [
      { "id": "A", "x": 0.45, "y": 0.30, "correctLabel": "Nucleus" },
      { "id": "B", "x": 0.60, "y": 0.55, "correctLabel": "Cell Wall" },
      { "id": "C", "x": 0.30, "y": 0.65, "correctLabel": "Chloroplast" }
    ],
    "labelBank": ["Nucleus", "Cell Wall", "Chloroplast", "Mitochondria", "Vacuole"]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | string | Yes | `"label"` or `"identify"` |
| `imageUrl` | string | Yes | The diagram image URL (from Pexels visual aid or uploaded asset) |
| `pins` | array | Yes | Array of pin objects with position and correct label |
| `pins[].id` | string | Yes | Short label shown on the pin button (`"A"`, `"1"`, etc.) |
| `pins[].x` | number | Yes | Horizontal position as a fraction of image width (0.0–1.0) |
| `pins[].y` | number | Yes | Vertical position as a fraction of image height (0.0–1.0) |
| `pins[].correctLabel` | string | Yes | Must match one entry in `labelBank` |
| `labelBank` | string[] | Yes | All possible labels including distractors; shuffle at render time |

**Validation model:**
- Each pin is validated independently; correct placements lock in green
- All pins must be correctly labeled to pass; Check validates all at once
- `labelBank` should include 1–2 distractors beyond the actual pin count

**Fallback:** `word_bank` — "What is the part labeled A?" as separate questions.

**Mockup:** *Pending.*

**Build notes:**
- Image rendered in a fixed-aspect-ratio container; pins positioned with `position: 'absolute'` using `left: x * containerWidth` and `top: y * containerHeight`
- Pin button: circular, numbered, accent-colored; tapped pin shows a word bank overlay
- Word bank overlay renders as a bottom sheet or popover near the pin
- Image must be square or 4:3 to avoid layout issues; landscape images constrained to screen width
- The `imageUrl` field uses the same Pexels visual aid slot already in the question schema — no new storage required

---

### S4. Context Clues Highlighter

**Status:** Specced — Pending Mockup

**Description:**
A short passage (2–4 sentences) with one underlined vocabulary word. Specific phrases or sentence fragments within the passage serve as context clues for the word's meaning. The student taps sentence fragments to highlight them. After highlighting, the question transitions to a standard MC or fill_in asking for the word's definition. Targets reading comprehension and vocabulary inference skills.

**Grade range:** Grades 2–6 (Reading / ELA)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `highlight` | Tap sentence fragments (spans) that help define the underlined word, then answer the meaning question |

**AI schema:**
```json
{
  "toolType": "context_clues",
  "geometry": {
    "passage": "The enormous elephant, taller than any tree in the yard, lumbered slowly through the gate.",
    "targetWord": "enormous",
    "spans": [
      { "text": "taller than any tree in the yard", "isClue": true },
      { "text": "lumbered slowly", "isClue": false }
    ]
  },
  "type": "multiple_choice",
  "question": "What does the word enormous most likely mean?",
  "options": ["very small", "very large", "very fast", "very old"],
  "correctIndex": 1
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `passage` | string | Yes | The full passage text (keep under 100 words) |
| `targetWord` | string | Yes | The vocabulary word to define (displayed underlined in the passage) |
| `spans` | array | Yes | Passage segments split for tapping; `isClue: true` segments are the correct highlights |
| After highlighting | — | — | The definition question is answered via the standard MC / fill_in layer |

**Validation model:**
- Highlighting phase: student must tap at least one `isClue: true` span; extra taps on non-clue spans are neutral
- Definition phase: validated by standard MC / fill_in logic

**Fallback:** `multiple_choice` — definition question without the highlighting interaction.

**Mockup:** *Pending.*

**Build notes:**
- Passage rendered as a sequence of `Text` spans; `isClue` spans are tappable
- Tapped spans get a highlight background; tapped again → de-highlighted
- `targetWord` rendered with an underline style wherever it appears in the passage
- After the student taps "Check Clues," the screen transitions (slide) to the definition MC question

---

### S5. Venn Diagram Sorter

**Status:** Specced — Pending Mockup

**Description:**
Two overlapping circles (or three for advanced). A chip bank below. The student taps a chip and then taps its correct region: left only, right only, or the center overlap (shared). Used for compare-and-contrast tasks across Reading, Science, and Social Studies.

**Grade range:** Grades 2–6 (Reading, Science, Social Studies)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `two_circle` | Two overlapping circles with a shared center region; tap chip → tap region |
| `three_circle` | Three overlapping circles with multiple shared regions (advanced; Grades 5+) |

**AI schema:**
```json
{
  "toolType": "venn_diagram",
  "geometry": {
    "mode": "two_circle",
    "label1": "Frogs",
    "label2": "Fish",
    "items": [
      { "text": "Lives in water", "placement": "both" },
      { "text": "Has legs", "placement": "left" },
      { "text": "Has gills", "placement": "right" },
      { "text": "Cold-blooded", "placement": "both" },
      { "text": "Lays eggs on land", "placement": "left" }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | string | Yes | `"two_circle"` (start here) or `"three_circle"` |
| `label1` | string | Yes | Label for the left circle |
| `label2` | string | Yes | Label for the right circle |
| `items` | array | Yes | 4–8 chips; each has `text` and `placement`: `"left"`, `"right"`, or `"both"` |

**Validation model:**
- Each chip validated independently; correct placement locks green
- All chips must be correctly placed to complete

**Fallback:** `classification_sort` (two-way) or `multiple_choice` per item.

**Mockup:** *Pending.*

**Build notes:**
- Two overlapping ovals rendered with SVG or `View` with `borderRadius`; overlap region visually distinct
- Chip bank below the diagram; tap chip → tap region → chip snaps inside the circle region
- Keep items to 4–6 for the two-circle mode to avoid crowding

---

### S6. Life Cycle Sequencer

**Status:** Specced — Pending Mockup

**Description:**
A cyclic wheel (for true cycles: water cycle, butterfly metamorphosis) or a linear chain (for growth sequences: seed to plant, egg to adult). Stage chips are shuffled in a bank; the student taps a chip and then taps the correct numbered slot around the wheel or along the chain.

**Grade range:** Grades 2–5 (Science)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `cycle` | Stages placed around a circular wheel; arrows connect slots clockwise |
| `chain` | Stages placed in left-to-right linear slots with forward arrows |

**AI schema:**
```json
{
  "toolType": "lifecycle_sequence",
  "geometry": {
    "mode": "cycle",
    "title": "Butterfly Life Cycle",
    "stages": [
      { "label": "Egg", "correctIndex": 0, "imageUrl": null },
      { "label": "Caterpillar", "correctIndex": 1, "imageUrl": null },
      { "label": "Chrysalis", "correctIndex": 2, "imageUrl": null },
      { "label": "Butterfly", "correctIndex": 3, "imageUrl": null }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | string | Yes | `"cycle"` or `"chain"` |
| `title` | string | No | Displayed above the diagram |
| `stages` | array | Yes | 3–6 stage objects with `label` and `correctIndex` |
| `stages[].imageUrl` | string | No | Optional small image per stage (e.g. Pexels photo) |

**Validation model:**
- All stages must be placed in their `correctIndex` slots to complete
- `cycle` mode: slots arranged as a clock face (top = index 0, clockwise)
- `chain` mode: slots arranged left to right

**Fallback:** `ordering` — stage labels as chips to sequence.

**Mockup:** *Pending.*

**Build notes:**
- `cycle` mode: slots positioned around a center circle using trigonometry (`sin`/`cos` offset from center)
- `chain` mode: horizontal `ScrollView` with arrow connectors between slots; same chip-tap-slot interaction
- Arrows drawn between consecutive slots to reinforce the directional flow
- Optional `imageUrl` on each stage renders a small square image inside the chip

---

### S7. Map Labeler

**Status:** Specced — Pending Mockup

**Description:**
A vector or image-based map with tappable region overlays. The student taps a region and assigns it the correct name from a word bank. Suitable for US states, continents, oceans, world regions, and local geography. Uses the same coordinate-pin overlay system as Diagram Labeler.

**Grade range:** Grades 3–8 (Social Studies)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `label` | Tap an unlabeled region → word bank appears → select the correct name |
| `locate` | A name is given; student taps the correct region on the map |

**AI schema:**
```json
{
  "toolType": "map_label",
  "geometry": {
    "mode": "label",
    "mapId": "us_regions",
    "imageUrl": "https://...",
    "regions": [
      { "id": "NE", "x": 0.82, "y": 0.18, "correctLabel": "Northeast" },
      { "id": "SE", "x": 0.75, "y": 0.55, "correctLabel": "Southeast" },
      { "id": "MW", "x": 0.52, "y": 0.35, "correctLabel": "Midwest" },
      { "id": "SW", "x": 0.28, "y": 0.60, "correctLabel": "Southwest" },
      { "id": "W",  "x": 0.12, "y": 0.35, "correctLabel": "West" }
    ],
    "labelBank": ["Northeast", "Southeast", "Midwest", "Southwest", "West"]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | string | Yes | `"label"` or `"locate"` |
| `mapId` | string | No | Hint for which map image to load; `"us_regions"`, `"continents"`, `"world_oceans"`, etc. |
| `imageUrl` | string | Yes | The map image URL |
| `regions` | array | Yes | Same pin format as Diagram Labeler (`id`, `x`, `y`, `correctLabel`) |
| `labelBank` | string[] | Yes | All region names including any distractors |

**Validation model:**
- Same pin-validation model as Diagram Labeler
- `locate` mode: only one pin is active at a time; correct tap highlights in green, wrong tap shakes

**Fallback:** `multiple_choice` — "What region is shown in the highlighted area?"

**Mockup:** *Pending.*

**Build notes:**
- Shares the pin-on-image rendering system with Diagram Labeler — build Diagram Labeler first and extract the overlay component as a shared primitive
- Map images sourced from Pexels (labeled political maps) or bundled as static assets
- Pin dots styled slightly larger than Diagram Labeler pins for easier tapping on small maps

---

### S8. Main Idea Web

**Status:** Specced — Pending Mockup

**Description:**
A graphic organizer with one "Main Idea" box at the top and three "Supporting Detail" boxes below connected by lines. A chip bank contains the correct main idea, three correct details, and 1–2 distractors mixed together. The student drags or taps chips into the correct box. Targets main idea / supporting detail comprehension in Reading.

**Grade range:** Grades 2–5 (Reading / ELA)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `place` | Tap a chip from the bank, then tap the Main Idea or Detail box to place it |

**AI schema:**
```json
{
  "toolType": "main_idea_web",
  "geometry": {
    "mainIdea": "Bees are important to the environment.",
    "details": [
      "Bees pollinate flowers and crops.",
      "Without bees, many plants could not reproduce.",
      "Bees make honey, which many animals eat."
    ],
    "distractors": ["Bees can sting people.", "Honey tastes sweet."]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mainIdea` | string | Yes | The correct main idea sentence |
| `details` | string[] | Yes | Exactly 3 supporting detail sentences |
| `distractors` | string[] | No | 1–2 sentences that are related but not main idea or details |

**Validation model:**
- Main Idea box: correct if the `mainIdea` chip is placed there
- Each Detail box: correct if one of the three `details` chips is placed (any order)
- Distractors must not be placed (if placed, they're removed with a shake)

**Fallback:** `word_bank` — fill-in using the main idea sentence.

**Mockup:** *Pending.*

---

### S9. Food Chain Builder

**Status:** Specced — Pending Mockup

**Description:**
A set of organism chips arranged on screen. The student builds a food chain by tapping a source organism and then tapping a target organism to draw a directional "eats" arrow between them. Correct connections lock with a green arrow; incorrect connections are removed. Tests understanding of producer/consumer/predator/prey relationships.

**Grade range:** Grades 3–6 (Science)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `build` | Tap organism A → tap organism B → arrow drawn from A to B (A is eaten by B) |

**AI schema:**
```json
{
  "toolType": "food_chain",
  "geometry": {
    "organisms": [
      { "id": "grass",  "label": "Grass",     "imageUrl": null },
      { "id": "rabbit", "label": "Rabbit",    "imageUrl": null },
      { "id": "fox",    "label": "Fox",        "imageUrl": null },
      { "id": "eagle",  "label": "Eagle",     "imageUrl": null }
    ],
    "connections": [
      { "from": "grass",  "to": "rabbit" },
      { "from": "rabbit", "to": "fox" },
      { "from": "fox",    "to": "eagle" }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `organisms` | array | Yes | 3–5 organism objects; optional `imageUrl` for small image chip |
| `connections` | array | Yes | Correct directed edges; `from` is eaten by `to` |

**Validation model:**
- All `connections` must be drawn; no extra incorrect connections allowed
- Correct connections lock green; incorrect connections are removed with a shake after a short delay

**Fallback:** `ordering` — organisms as chips to put in predator-prey order.

**Mockup:** *Pending.*

**Build notes:**
- Organisms rendered as chips in a 2-column grid; arrows drawn using SVG `<line>` elements over the layout
- Tap state: first tap selects source (highlighted), second tap on different chip attempts connection
- Arrow direction: from selected to target, rendered as a line with an arrowhead at the target end
- Keep to 3–4 organisms initially; 5 creates visual clutter

---

### S10. Parts of Speech Tagger

**Status:** Specced — Pending Mockup

**Description:**
A sentence displayed word by word as individual tappable chips. The student taps each word and assigns it a grammatical role (noun, verb, adjective, adverb, pronoun) from a role chip bank. Correct words get a color-coded badge. Targets grammar and parts-of-speech recognition in Reading / ELA.

**Grade range:** Grades 2–5 (Reading / ELA)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `tag_all` | All words must be tagged (short sentence, 5–8 words) |
| `tag_target` | Only underlined target words must be tagged (longer sentences) |

**AI schema:**
```json
{
  "toolType": "word_tag",
  "geometry": {
    "mode": "tag_target",
    "sentence": ["The", "big", "dog", "ran", "quickly", "away"],
    "tagOptions": ["noun", "verb", "adjective", "adverb"],
    "targets": [
      { "index": 2, "correctTag": "noun" },
      { "index": 3, "correctTag": "verb" },
      { "index": 4, "correctTag": "adverb" }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | string | Yes | `"tag_all"` or `"tag_target"` |
| `sentence` | string[] | Yes | The sentence as an array of individual word strings |
| `tagOptions` | string[] | Yes | Available roles to assign (keep to 3–4 options) |
| `targets` | array | `tag_target` mode | Words that must be tagged; `index` is 0-based position in `sentence` |

**Validation model:**
- `tag_all`: every word must be tagged correctly
- `tag_target`: only `targets` words are scored; other words are non-interactive
- Correct tags lock with a color badge; incorrect tags return to untagged state with a shake

**Fallback:** `multiple_choice` — "What part of speech is the word 'quickly'?"

**Mockup:** *Pending.*

---

## Adding a New Tool

When a new tool is ready to be designed:

1. Add a section here following the Tool Template
2. Fill in description, grade range, interaction modes, AI schema, validation model, and fallback type
3. Attach or reference the mockup image
4. Update the build order table in [ROADMAP.md](./ROADMAP.md)
5. Only then begin building the shell

The code never comes before the spec.
