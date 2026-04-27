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

**Status:** Pending Redesign

**Description:**
A virtual ruler rendered on screen. The student drags a marker to measure a colored bar segment. The tool draws its own bar stimulus so no external image is needed.

**Grade range:** Grades 1–8 (measurement units)

**Interaction modes / subtypes:**

| Subtype | What the student does |
|---|---|
| `endpoint` | Bar starts at 0. Student drags to find where the bar ends. |
| `offset` | Bar starts at a non-zero position. Student measures the *length* (end minus start). |
| `compare` | Two colored bars shown. Student picks which is longer (3-button multiple choice). |
| `difference` | Two colored bars shown. Student drags to find the difference in length. |

**AI schema:**
```json
{
  "toolType": "ruler",
  "geometry": {
    "rulerSubtype": "endpoint",
    "length": 3.5,
    "unit": "inch",
    "color": "blue",
    "rulerMax": 5,
    "start": 0
  }
}
```

**Fallback:** `fill_in` — "How long is the blue bar?" with `correctAnswer: "3.5"`

**Mockup:** *Pending redesign after Protractor is complete.*

---

### 3. Number Line

**Status:** Pending Redesign

**Description:**
A virtual number line. Depending on mode, the student drags a point to a target value, reads a pre-placed point, or counts equal parts.

**Grade range:** Grades 1–8

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `place` | Student drags a point to the target value. |
| `read` | A point is pre-placed. Student picks its value from multiple choice. |
| `count` | Equal-part tick marks shown. Student picks how many parts from multiple choice. |

**AI schema:**
```json
{
  "toolType": "number_line",
  "geometry": {
    "min": 0,
    "max": 1,
    "step": 0.25,
    "target": 0.75,
    "mode": "place"
  }
}
```

**Fallback:** `fill_in` for place/read; `multiple_choice` for count.

**Mockup:** *Pending redesign after Ruler is complete.*

---

### 4. Analog Clock

**Status:** Shell Built — AI schema wiring pending

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

**Status:** Building — Shell complete, AI schema wired

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

### 8. Bar / Line Chart

**Status:** Pending Mockup

**Description:**
A rendered bar chart or line graph. Student reads a value, compares bars, or identifies a trend.

**Grade range:** Grades 3–8

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read_value` | Student reads a specific bar or point value. |
| `compare` | Student identifies the highest, lowest, or difference. |

**AI schema:**
```json
{
  "toolType": "chart",
  "geometry": {
    "chartType": "bar",
    "labels": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "values": [4, 7, 3, 8, 5],
    "yLabel": "Books Read",
    "mode": "read_value",
    "targetLabel": "Wed"
  }
}
```

**Fallback:** `multiple_choice` — question rephrased around the chart data.

**Mockup:** *Waiting for designer mockup.*

---

### 9. Timeline

**Status:** Pending Mockup

**Description:**
A horizontal timeline with labeled events. Student orders events by dragging, or reads a date/sequence from a pre-built timeline.

**Grade range:** Grades 3–8 (Social Studies, History)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read` | Timeline is shown. Student answers a question about it. |
| `order` | Student drags event cards onto the timeline in correct order. |

**AI schema:**
```json
{
  "toolType": "timeline",
  "geometry": {
    "mode": "order",
    "events": [
      { "label": "Declaration of Independence", "year": 1776 },
      { "label": "Constitution signed", "year": 1787 },
      { "label": "Bill of Rights ratified", "year": 1791 }
    ]
  }
}
```

**Fallback:** `ordering` — event labels as chips to order.

**Mockup:** *Waiting for designer mockup.*

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

## Adding a New Tool

When a new tool is ready to be designed:

1. Add a section here following the Tool Template
2. Fill in description, grade range, interaction modes, AI schema, validation model, and fallback type
3. Attach or reference the mockup image
4. Update the build order table in [ROADMAP.md](./ROADMAP.md)
5. Only then begin building the shell

The code never comes before the spec.
