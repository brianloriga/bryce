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

**Status:** Pending Mockup

**Description:**
A virtual protractor rendered on screen. The student interacts with it to measure or construct an angle. The tool draws its own angle stimulus (rays from a vertex) so no external image is needed — this is the key difference from the old approach.

**Grade range:** Grades 4–8 (geometry units)

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read` | An angle is drawn at a fixed position. Student reads the scale and types the degree value. No dragging. |
| `build` | Student drags an arm to construct a stated angle (e.g. "Draw a 65° angle"). No reference arm shown. |
| `align` | Student positions the protractor arm over a drawn angle and types the value they read. |

**AI schema:**
```json
{
  "toolType": "protractor",
  "geometry": {
    "angleDeg": 68,
    "mode": "read",
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
| `mode` | string | Yes | `"read"`, `"build"`, or `"align"` |
| `vertex` | string | No | Label for the vertex point (e.g. `"M"`) |
| `ray1` | string | No | Label for the first ray end (e.g. `"N"`) |
| `ray2` | string | No | Label for the second ray end (e.g. `"L"`) |
| `flipped` | boolean | No | `true` = baseline points left (180°); `false` = baseline points right (0°) |

**Validation model:**
- `read` mode: student's typed value is correct if within ±5° of `angleDeg`
- `build` mode: student's dragged position is correct if within ±5° of `angleDeg`
- `align` mode: student's typed value is correct if within ±5° of `angleDeg`
- Diagnostic feedback for common mistakes: wrong scale (supplement), acute/obtuse confusion, right angle off-by-one

**Fallback:** `fill_in` — "What is the measure of angle MNL?" with `correctAnswer: "68"`

**Mockup:** *Waiting for designer mockup.*

**Build notes:**
- The tool draws its own angle (vertex + two rays) inside the protractor view — no external image reference
- `flipped: true` mirrors all screen angles and reverses the degree scale labels to match real left-handed protractor orientation
- Scale-choice step (which 0° to read from) only shown for obtuse angles or flipped mode where ambiguity is genuine
- Slider starts at a random position at least 30° from the answer so the exercise requires real interaction

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

**Status:** Pending Mockup

**Description:**
A procedurally drawn analog clock face. In read mode, the hands are set to a specific time and the student identifies the time. In draw mode, the student drags the hands to show a stated time.

**Grade range:** Grades 1–3

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read` | Clock shows a fixed time. Student types or selects the time (e.g. "3:15"). |
| `draw` | Student drags hour and minute hands to show a stated time. |

**AI schema:**
```json
{
  "toolType": "clock",
  "geometry": {
    "hours": 3,
    "minutes": 15,
    "mode": "read"
  }
}
```

**Fallback:** `multiple_choice` — "What time does the clock show? A) 3:15 B) 3:45 C) 2:15 D) 4:15"

**Mockup:** *Waiting for designer mockup.*

---

### 5. Coin / Money

**Status:** Pending Mockup

**Description:**
Displays labeled coin images (penny, nickel, dime, quarter, dollar). Student calculates the total value and types or selects it.

**Grade range:** Grades 1–3

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `count` | Student counts the total value of the displayed coins. |
| `select` | Student taps coins from a pool to make an exact amount. |

**AI schema:**
```json
{
  "toolType": "coin",
  "geometry": {
    "coins": [
      { "denomination": "quarter", "count": 2 },
      { "denomination": "dime", "count": 3 }
    ],
    "mode": "count"
  }
}
```

**Fallback:** `fill_in` — "How much money is shown?" with `correctAnswer: "0.80"`

**Mockup:** *Waiting for designer mockup.*

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

**Status:** Pending Mockup

**Description:**
A horizontal segmented bar split into equal parts. Some parts are shaded. Student identifies the fraction shown, or shades parts to build a stated fraction.

**Grade range:** Grades 3–5

**Interaction modes:**

| Mode | What the student does |
|---|---|
| `read` | Bar is pre-shaded. Student identifies the fraction. |
| `shade` | Student taps segments to shade the correct fraction. |

**AI schema:**
```json
{
  "toolType": "fraction_bar",
  "geometry": {
    "mode": "read",
    "parts": 4,
    "shaded": 3
  }
}
```

**Fallback:** `multiple_choice` — "What fraction of the bar is shaded?"

**Mockup:** *Waiting for designer mockup.*

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

## Adding a New Tool

When a new tool is ready to be designed:

1. Add a section here following the Tool Template
2. Fill in description, grade range, interaction modes, AI schema, validation model, and fallback type
3. Attach or reference the mockup image
4. Update the build order table in [ROADMAP.md](./ROADMAP.md)
5. Only then begin building the shell

The code never comes before the spec.
