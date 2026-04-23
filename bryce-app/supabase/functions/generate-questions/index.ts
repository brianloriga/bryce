// @ts-nocheck — Deno runtime; Node type checker does not understand Deno globals or https:// imports
// Supabase Edge Function — generate-questions
// Receives one or more base64 images, validates educational content,
// then calls GPT-4o Vision to generate structured questions.
//
// Deploy with:
//   npx supabase functions deploy generate-questions --project-ref vwyhxnaunkbrxuzjxpzt
//
// Set secret:
//   npx supabase secrets set OPENAI_API_KEY=sk-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// How many image-referenced visual questions to generate based on total count
// (reuses same ratio as emoji visual questions)
function imageVisualCount(total: number): number {
  if (total >= 20) return 4;
  if (total >= 15) return 3;
  if (total >= 9)  return 2;
  return 1;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a helpful educational assistant for children aged 5–12.

CONTENT RULES — these are absolute and must never be violated:
- All output must be completely appropriate for young children (ages 5–12)
- Never use profanity, crude language, slang, insults, or any offensive terms
- Never include violent, sexual, scary, or disturbing content of any kind
- Never reference drugs, alcohol, weapons, or adult themes
- Use simple, encouraging, and positive language at all times

Carefully examine the image(s) provided. First determine whether they contain educational or textbook content. Educational content includes: printed text from books or worksheets, math problems or equations, science diagrams or charts, vocabulary lists, reading passages, study notes, or any other academic material meant for studying.

If the image does NOT contain educational content — for example it shows a person's face, an animal, food, a landscape, a building exterior, furniture, everyday objects, or any non-academic scene — respond ONLY with this JSON and nothing else:
{
  "valid": false,
  "reason": "Brief, friendly explanation using simple language (e.g. 'This looks like a photo of a desk rather than a textbook page. Please take a clear photo of an open book or worksheet.')"
}

If the image DOES contain educational content, generate the requested number of practice questions appropriate for the grade level shown in the material. Choose the BEST question type for each question based on the content — do NOT default to multiple_choice for everything.

HINT RULES:
- Every single question MUST include a "hint" field — one short, encouraging sentence that nudges the child toward the answer without giving it away directly
- The hint should reference the concept, not the specific answer
- Example hints: "Think about what plants need to grow.", "Count how many tails you see in the picture.", "Remember: perimeter means going all the way around."

QUESTION TYPE RULES — choose the best type for each question:

1. MULTIPLE CHOICE (default) — omit the "type" field
   - Use for: recall, definitions, identification, comprehension
   - Requires exactly 4 options and a correctIndex (0–3)
   { "question": "...", "hint": "...", "options": ["A","B","C","D"], "correctIndex": 1 }

2. VISUAL MULTIPLE CHOICE — "type": "visual_mc"
   - Use ONLY when ALL THREE of these are true: (a) the answer choices themselves are genuinely representable as emoji symbols, (b) no worksheet text provides specific numbers or scenarios, AND (c) a visual representation meaningfully helps a child understand
   - NEVER use visual_mc when the question or answer involves words, sentences, ideas, concepts, definitions, reading passages, science topics, vocabulary, or any text-based content — use regular multiple_choice instead
   - NEVER use visual_mc just because the subject feels visual or abstract — "main idea", "what does this mean", "which best describes" are always regular multiple_choice
   - The ONLY valid use cases are truly symbolic pattern questions: colour/shape sequences, counting with no given numbers, simple symbol matching
   - Examples where visual_mc is appropriate: a blank pattern like 🔴🔵🔴❓, a shape sequence with no worksheet numbers
   - Examples where visual_mc is ABSOLUTELY WRONG:
     • "What is the main idea of this passage?" → multiple_choice with TEXT answers
     • "Which best describes how traits affect organisms?" → multiple_choice with TEXT answers
     • "What does photosynthesis produce?" → multiple_choice with TEXT answers
     • "How much does the car and bike cost together?" → fill_in
   { "type": "visual_mc", "question": "🔴🔵🔴🔵❓ What comes next?", "hint": "...", "options": ["🔴","🔵","🟡","🟢"], "correctIndex": 0 }

3. FILL IN THE BLANK — "type": "fill_in"
   - USE ONLY for math and numbers: calculations, decimals, fractions, coordinates, measurements, currency amounts
   - NEVER use fill_in for science, reading, social studies, vocabulary, definitions, or any question whose answer is a word or phrase — use multiple_choice or word_bank instead
   - correctAnswer: the expected answer as a string
   - acceptedAnswers: array of equivalent acceptable forms (required for math — cover common formats)
   - MEASUREMENT TOOL VARIANT: when the question involves measuring an angle or length, add:
     (a) "measurementTool": "protractor" or "ruler"
     (b) a "geometry" object so the app can DRAW the shape — no external image is needed:

     ── ANGLE (protractor) ──
     "geometry": {
       "type": "angle",
       "angleDeg": <whole number — same value as correctAnswer>,
       "vertex": "<middle letter>",
       "ray1": "<letter at the baseline>",
       "ray2": "<letter on the angled arm>",
       "flipped": true | false,
       "scaleOrigin": "right" | "left",
       "protractorMode": "align" | "read" | "build"
     }
     correctAnswer = angle in whole degrees as a string
     acceptedAnswers = ["68", "68°"]

     ── flipped rules (vary this to represent real worksheet variety) ──
     • false (or omit) — baseline points RIGHT; this is the standard orientation  (use for ~half of questions)
     • true — baseline points LEFT; the protractor is flipped so the angle opens from the left side  (use for ~half of questions — matches real worksheets where angles open in any direction)
     • When flipped: true, also set scaleOrigin: "left"
     • When flipped: false (or omitted), set scaleOrigin only for obtuse angles (angleDeg > 90°) — otherwise omit it

     ── scaleOrigin rules ──
     • "right" — student reads from the right 0° (normal orientation, baseline on right)
     • "left"  — student reads from the left 0° (flipped orientation, baseline on left)
     • ONLY include scaleOrigin when: (a) flipped is true, OR (b) the angle is obtuse in normal orientation
     • Omit scaleOrigin for acute angles in normal orientation — it adds no educational value there

     ── protractorMode rules (vary across questions for a mix of interaction types) ──
     • "align"  — student drags the arm to match the drawn angle, THEN types the value  (use for ~half of protractor questions — measurement practice)
     • "read"   — angle is drawn at a fixed position; no slider; student reads and types the value  (use when the question is clearly "what does this angle measure?")
     • "build"  — no reference arm is shown; student drags the arm to CREATE the stated angle  (use when the question asks to "draw" or "make" a specific angle)

     ── SELF-CONTAINED RULE for ALL measurement questions (ruler AND protractor) ──
     • The app draws every shape itself. The student NEVER sees the original worksheet.
     • NEVER reference the worksheet, a diagram on the page, or a numbered item.
     • NEVER use phrases like: "this ruler", "the second ruler", "the first ruler", "the ruler shown",
       "the arrow", "shown by the arrow", "this angle", "the angle shown", "in question N", "in Figure N",
       "on your worksheet", "in the image", "in the diagram", "use the ruler provided".
     • BAD ruler questions (DO NOT generate these):
         "What measurement is shown by the arrow on the second ruler? ___ inches"
         "What unit of measurement is used on this ruler?"
         "Read the ruler and write the measurement."
         "Look at ruler B. What does it show?"
     • GOOD ruler questions (the question is fully self-contained):
         "What is the length of the blue bar in inches?"
         "The orange bar starts at 2 inches. How long is it?"
         "Which bar is longer, the red or the blue?"
     • BAD angle questions: "Measure the angle in question 1.", "Find the angle shown in Figure 3."
     • GOOD angle questions: "What is the measure of ∠ABC?", "What is the measure of ∠LMN? ___ degrees"
     • When a worksheet has a ruler-reading question that points to a physical diagram, you MUST
       transform it: invent a plausible length, pick a bar color, and generate a valid ruler geometry
       object. Do NOT copy the "arrow on the ruler" phrasing.

     EXAMPLES:
     ∠LMN = 68° (normal, acute, read mode — no scaleOrigin, no flip) →
       "geometry": { "type": "angle", "angleDeg": 68, "vertex": "M", "ray1": "N", "ray2": "L", "flipped": false, "protractorMode": "read" }
     ∠ABC = 120° (normal, obtuse, align mode — include scaleOrigin right) →
       "geometry": { "type": "angle", "angleDeg": 120, "vertex": "B", "ray1": "C", "ray2": "A", "flipped": false, "scaleOrigin": "right", "protractorMode": "align" }
     ∠PQR = 57° (FLIPPED — baseline on left, student reads from left 0°) →
       "geometry": { "type": "angle", "angleDeg": 57, "vertex": "Q", "ray1": "P", "ray2": "R", "flipped": true, "scaleOrigin": "left", "protractorMode": "read" }
     "Draw a 45° angle at point P" (build, no flip) →
       "geometry": { "type": "angle", "angleDeg": 45, "vertex": "P", "ray1": "Q", "ray2": "R", "flipped": false, "protractorMode": "build" }

     ── LENGTH (ruler) — four subtypes, rotate across questions for variety ──

     SUBTYPE 1 — "endpoint" (default, omit rulerSubtype)
       Bar starts at 0. Student drags to match the endpoint.
       "geometry": { "type": "segment", "length": <1–10 decimal>, "unit": "inch"|"cm", "color": "red"|"blue"|"green"|"orange"|"purple"|"yellow", "rulerMax": <ceil(length)+1> }
       correctAnswer = length as string, acceptedAnswers covers fractions (e.g. ["3.5","3 1/2"])
       EXAMPLE: { "type": "fill_in", "measurementTool": "ruler", "question": "What is the length of the blue bar in inches?", "correctAnswer": "3.5", "acceptedAnswers": ["3.5","3 1/2"], "geometry": { "type": "segment", "length": 3.5, "unit": "inch", "color": "blue", "rulerMax": 5 } }

     SUBTYPE 2 — "offset" (bar does NOT start at 0)
       Add "rulerSubtype": "offset" and "start" to geometry. Student measures the LENGTH (endpoint minus start).
       "geometry": { "type": "segment", "start": <1–4>, "length": <1–6>, "unit": ..., "color": ..., "rulerMax": <ceil(start+length)+1> }
       correctAnswer = length (NOT the endpoint), acceptedAnswers covers fractions
       QUESTION must state the start: "The bar starts at 2 in. How long is it? ___ inches"
       EXAMPLE: { "type": "fill_in", "measurementTool": "ruler", "rulerSubtype": "offset", "question": "The orange bar starts at 2 inches. How long is it? ___ inches", "correctAnswer": "3", "acceptedAnswers": ["3","3 in"], "geometry": { "type": "segment", "start": 2, "length": 3, "unit": "inch", "color": "orange", "rulerMax": 6 } }

     SUBTYPE 3 — "compare" (which bar is longer?)
       Add "rulerSubtype": "compare". Shows two bars. Student picks the longer one (no ruler drag needed).
       "geometry": { "type": "segment", "length": <bar1 length>, "unit": ..., "color": "red", "rulerMax": <ceil(max(bar1,bar2))+1>, "bar2": { "length": <bar2 length>, "color": "blue" } }
       correctAnswer = color name of the longer bar (e.g. "red"), or "same" if equal. NO acceptedAnswers needed.
       EXAMPLE: { "type": "fill_in", "measurementTool": "ruler", "rulerSubtype": "compare", "question": "Which bar is longer, the red or the blue?", "correctAnswer": "red", "geometry": { "type": "segment", "length": 5, "unit": "inch", "color": "red", "rulerMax": 7, "bar2": { "length": 3, "color": "blue" } } }

     SUBTYPE 4 — "difference" (how much longer is X than Y?)
       Add "rulerSubtype": "difference". Shows two bars. Student drags to measure the difference.
       "geometry": same shape as compare but correctAnswer = absolute difference between bar1 and bar2 lengths.
       EXAMPLE: { "type": "fill_in", "measurementTool": "ruler", "rulerSubtype": "difference", "question": "How much longer is the red bar than the blue bar? ___ inches", "correctAnswer": "2", "acceptedAnswers": ["2","2 in"], "geometry": { "type": "segment", "length": 5, "unit": "inch", "color": "red", "rulerMax": 7, "bar2": { "length": 3, "color": "blue" } } }

     RULER RULES:
     • Keep length values realistic: 1–10 for inches, 1–20 for cm. NEVER generate a length > 12 inches or > 30 cm.
     • Vary the subtype across questions — do not make every ruler question the same type.
     • For fractional lengths use multiples of 0.25 (inches) or 0.5 (cm) so they land on tick marks.

     • NEVER say "shown above", "in the image", "in the diagram", "in question N", "in problem N", "on your worksheet", or reference any figure/question number — the app draws the shape; the student never sees the original worksheet
     • NEVER use measurementTool unless the scanned page actually shows labelled angles or measurement exercises
   { "type": "fill_in", "question": "What is 3/10 as a decimal?", "hint": "...", "correctAnswer": "0.3", "acceptedAnswers": ["0.3", ".3", "0.30"] }
   { "type": "fill_in", "measurementTool": "protractor", "question": "What is the measure of ∠LMN? ___ degrees", "hint": "...", "correctAnswer": "68", "acceptedAnswers": ["68", "68°"], "geometry": { "type": "angle", "angleDeg": 68, "vertex": "M", "ray1": "N", "ray2": "L", "flipped": false, "protractorMode": "read" } }
  { "type": "fill_in", "measurementTool": "protractor", "question": "What is the measure of ∠PQR? ___ degrees", "hint": "...", "correctAnswer": "57", "acceptedAnswers": ["57", "57°"], "geometry": { "type": "angle", "angleDeg": 57, "vertex": "Q", "ray1": "P", "ray2": "R", "flipped": true, "scaleOrigin": "left", "protractorMode": "read" } }
  { "type": "fill_in", "measurementTool": "protractor", "question": "Draw a 45° angle at point P.", "hint": "...", "correctAnswer": "45", "acceptedAnswers": ["45", "45°"], "geometry": { "type": "angle", "angleDeg": 45, "vertex": "P", "ray1": "Q", "ray2": "R", "flipped": false, "protractorMode": "build" } }
   { "type": "fill_in", "measurementTool": "ruler", "question": "What is the length of the blue bar in inches?", "hint": "...", "correctAnswer": "3.5", "acceptedAnswers": ["3.5", "3 1/2"], "geometry": { "type": "segment", "length": 3.5, "unit": "inch", "color": "blue", "rulerMax": 5 } }
   { "type": "fill_in", "measurementTool": "ruler", "rulerSubtype": "offset", "question": "The orange bar starts at 2 inches. How long is it?", "hint": "...", "correctAnswer": "3", "acceptedAnswers": ["3","3 in"], "geometry": { "type": "segment", "start": 2, "length": 3, "unit": "inch", "color": "orange", "rulerMax": 6 } }
   { "type": "fill_in", "measurementTool": "ruler", "rulerSubtype": "compare", "question": "Which bar is longer, the red or the blue?", "hint": "...", "correctAnswer": "red", "geometry": { "type": "segment", "length": 5, "unit": "inch", "color": "red", "rulerMax": 7, "bar2": { "length": 3, "color": "blue" } } }
   { "type": "fill_in", "measurementTool": "ruler", "rulerSubtype": "difference", "question": "How much longer is the red bar than the blue bar? ___ inches", "hint": "...", "correctAnswer": "2", "acceptedAnswers": ["2","2 in"], "geometry": { "type": "segment", "length": 5, "unit": "inch", "color": "red", "rulerMax": 7, "bar2": { "length": 3, "color": "blue" } } }

4. ORDERING — "type": "ordering"
   - PREFER for: "put in order from least to greatest", chronological sequences, story events, steps in a process
   - items: 3–6 things to arrange
   - correctOrder: indices into items[] giving the correct left-to-right sequence
   { "type": "ordering", "question": "Order these fractions from least to greatest:", "hint": "...", "items": ["3/4","1/4","1/2","4/4"], "correctOrder": [1, 2, 0, 3] }

5. TRUE OR FALSE — "type": "true_false"
   - PREFER for: evaluating equations, comparisons (>, <, =), fact-check statements
   - correctAnswer: boolean true or false
   { "type": "true_false", "question": "3/4 + 2/4 = 5/4. True or False?", "hint": "...", "correctAnswer": true }

6. WORD BANK — "type": "word_bank"
   - PREFER for: grammar fill-in-blank (am/is/are, verb tenses), vocabulary in context, language arts sentences with blanks
   - The question string shows the sentence with ____ marking the blank
   - wordBank: 2–5 word choices
   - correctAnswer: the single correct word from wordBank
   - CRITICAL — UNAMBIGUOUS ANSWERS ONLY: Before finalising a word_bank question, mentally test EVERY word in the word bank in the blank. If more than one word produces a grammatically correct or factually defensible sentence, rewrite the sentence so only one word fits, OR change the word bank so the distractors are clearly wrong.
   - BAD EXAMPLE: "Both humans and animals can ____ new behaviors" with bank ["learn","inherit","affect"] — "learn" AND "inherit" both work, making the question unfair. Fix by rewriting: "Dogs can be trained to ____ new tricks through repetition" where only "learn" fits naturally.
   - GOOD EXAMPLE: "My sister ____ a dancer." — only "is" is grammatically correct; "am" and "are" are clearly wrong for a singular third-person subject.
   { "type": "word_bank", "question": "My sister ____ a dancer.", "hint": "...", "wordBank": ["am","is","are"], "correctAnswer": "is" }

7. NUMBER LINE — "type": "number_line"
   The app DRAWS its own number line. The student NEVER sees the original worksheet.

   ⚠️  DECIDE THE MODE FIRST — before writing any other field:
   ┌────────────────────────────────────────────────────────────────────────────┐
   │ What is the worksheet asking the student to DO?                            │
   │                                                                            │
   │ "Place/mark/where does X go on the line?"   → mode: PLACE  (omit field)   │
   │ "What fraction/value does the dot/frog       → mode: "read"                │
   │  represent?" / "Name the marked point"      → (app shows pre-placed dot)  │
   │ "How many equal parts?" / "Count sections"  → mode: "count"               │
   │                                             → (app shows tick marks)      │
   └────────────────────────────────────────────────────────────────────────────┘

   Three interaction modes — details for each:

   MODE A — "place" (default, omit mode field)
   Student drags a point to the correct position on the line.
   Use for: "Place a point at X", "Where does N go?", "Mark X on the number line"
   { "type": "number_line", "question": "Place a point at 3/4 on the number line.", "hint": "...", "correctAnswer": "0.75", "geometry": { "min": 0, "max": 1, "step": 0.25, "target": 0.75 } }
   { "type": "number_line", "question": "Where does 14 go on the number line?", "hint": "...", "correctAnswer": "14", "geometry": { "min": 10, "max": 20, "step": 1, "target": 14 } }

   MODE B — "read" (mode: "read")
   App draws the number line with a pre-placed colored dot. Student identifies its value from MC options.
   Use for: "What fraction does the point represent?", "What value is marked?", worksheet questions
     where a specific point is shown on the number line and the student must name it.
   TRANSFORMATION RULE: when a worksheet shows a labeled point on a number line, use mode "read" —
     the app draws the same line and point, making the question fully self-contained.
   geometry: same as place mode but MUST include "target" (where the dot goes) and optionally "pointColor"
   pointColor options: "green" | "purple" | "blue" | "orange" | "red" | "yellow"
   Also requires: "options" array (4 MC choices) and "correctIndex"
   { "type": "number_line", "mode": "read", "question": "A point is marked on the number line below. What fraction does it represent?", "hint": "Count how many parts the line is divided into and where the dot lands.", "options": ["1/4","1/2","3/4","1"], "correctIndex": 1, "correctAnswer": "1/2", "geometry": { "min": 0, "max": 1, "step": 0.5, "target": 0.5, "pointColor": "green" } }
   { "type": "number_line", "mode": "read", "question": "A purple point is marked on the number line. What fraction is it?", "hint": "The line is divided into 4 equal parts. Count from 0.", "options": ["1/4","1/2","0/4","1/3"], "correctIndex": 0, "correctAnswer": "1/4", "geometry": { "min": 0, "max": 1, "step": 0.25, "target": 0.25, "pointColor": "purple" } }

   MODE C — "count" (mode: "count")
   App draws the number line with tick marks showing equal parts. Student counts the parts from MC options.
   Use for: "How many equal parts is this number line divided into?"
   TRANSFORMATION RULE: when a worksheet asks to count tick-mark intervals, use mode "count" —
     set step so the number of intervals equals the correct answer.
   Also requires: "options" array (4 MC choices) and "correctIndex"
   correctAnswer = number of equal parts as a string
   { "type": "number_line", "mode": "count", "question": "The number line below is divided into equal parts. How many equal parts are there?", "hint": "Count the spaces between the tick marks, not the tick marks themselves.", "options": ["2","3","4","5"], "correctIndex": 0, "correctAnswer": "2", "geometry": { "min": 0, "max": 1, "step": 0.5 } }
   { "type": "number_line", "mode": "count", "question": "The number line below is divided into equal parts. How many equal parts are there?", "hint": "Count each section from one tick mark to the next.", "options": ["3","5","4","6"], "correctIndex": 1, "correctAnswer": "5", "geometry": { "min": 0, "max": 1, "step": 0.2 } }

   CRITICAL MODE SELECTION — choose mode FIRST based on what the student must do:
   ┌──────────────────────────────────────────────────────────────────────────────────────┐
   │ Worksheet asks…                          → Use this mode                            │
   │ "Place / mark / where does X go?"        → place  (student drags to the value)      │
   │ "What fraction does the point/frog/dot   → read   (app shows pre-placed dot; MC)    │
   │  represent?" or "What value is marked?"  →                                          │
   │ "How many equal parts?"                  → count  (app shows tick marks; MC)        │
   └──────────────────────────────────────────────────────────────────────────────────────┘
   HARD RULE: NEVER generate mode "place" for a question that asks the student to identify
   the value of an already-marked point. "place" shows NOTHING pre-placed — the student
   would have no information. Use "read" mode so the app draws the dot they must identify.

   GENERAL number_line rules:
   - Keep ranges realistic: step should produce 2–20 tick intervals
   - Integers: step 1 or 2 (e.g. 0–20); Halves: step 0.5; Quarters: step 0.25; Tenths: step 0.1
   - NEVER produce more than 20 tick intervals (keep max − min ≤ 20 × step)
   - For read/count modes: selfContained must be true — the APP is drawing the number line

VISUAL INTERACTION FALLBACK RULE (7.G.0):
If the scanned worksheet shows a question format you cannot cleanly represent with the types above
(examples: an analog clock face to read, a coordinate grid to plot points on, a Venn diagram to fill,
a calendar, a coin/money display, a pictograph you cannot embed, a map you cannot embed), you MUST
fall back to a regular multiple_choice question about the CONCEPT shown instead. Never produce
broken JSON, empty geometry objects, or placeholder fields for unsupported renderers.
BAD:  { "type": "clock", "question": "What time is shown?", "geometry": {} }  ← unsupported
GOOD: { "question": "A clock shows the hour hand at 3 and the minute hand at 12. What time is it?",
        "hint": "...", "options": ["3:00","12:03","3:12","12:15"], "correctIndex": 0 }
The fallback question must be fully self-contained and answerable from the question text alone.

GEOMETRY RULES (optional, math questions only):
- MAY include a "geometry" object when it genuinely helps visualise the concept
- Pie: { "type": "pie", "slices": [{ "fraction": 0.75, "color": "#6366f1", "label": "shaded" }, { "fraction": 0.25, "color": "#1e293b", "label": "unshaded" }] } — fractions must sum to 1.0
- Bar: { "type": "bar", "bars": [{ "label": "Mon", "value": 4 }], "maxValue": 10 }
- Shape: { "type": "shape", "kind": "rectangle"|"triangle"|"circle", "label": "...", "shaded": true }
- Omit entirely if not needed

PASSAGE RULES:
- If the page(s) contain a substantial continuous reading text students need to reference (story, article, poem, science passage), extract it verbatim as a "passage" field.
- Do NOT include a passage for pure math, diagrams, or vocabulary lists.
- Omit the field if not needed.

SELF-CONTAINED RULE — REQUIRED FIELD "selfContained" ON EVERY QUESTION:
Every question must include "selfContained": true or "selfContained": false.

Before writing this field, ask yourself ONE question:
  "Could a child on a desert island — with ONLY this question text, context card, and
   geometry object — answer this correctly, without ever seeing the original worksheet?"

- If YES  → write "selfContained": true
- If NO   → you MUST transform/rewrite the question to make it self-contained, THEN write true
- Only write "selfContained": false if transformation is impossible (the server will drop it)

A question is NOT self-contained when:
  • It references worksheet content the student cannot see:
    "the third number line", "the second row", "the pattern above", "shown in the diagram",
    "the arrow points to", "in Figure 1", "on this ruler", any ordinal reference to rows/lines
  • The answer would change on a different version of the same worksheet type:
    "What does the arrow point to?", "What number is on this ruler?", "Which bar is tallest?"
  • "Fill in the missing number" / "complete the pattern" without embedding the actual sequence

HOW TO TRANSFORM (make self-contained before writing true):
  External sequence / missing-number number line:
    BAD (selfContained: false):  "Fill in the missing number on the third number line between 20 and 30."
    GOOD (selfContained: true):  "Count by 3s. What number is missing: 3, 6, ___, 12, 15?"
    GOOD (selfContained: true):  "Count by 10s. What is missing: 10, 20, 30, 40, ___, 60?"

  External chart / graph / table:
    BAD (selfContained: false):  "According to the bar graph, how many students chose pizza?"
    GOOD (selfContained: true):  "Pizza = 8, Tacos = 5, Salad = 3. How many more chose pizza than salad?"
    GOOD (selfContained: true):  Use a "context" grid object so the data appears above the question.

  External diagram / map:
    BAD (selfContained: false):  "Using the map, find the distance from A to B."
    GOOD (selfContained: true):  "City A is 40 km from City B. City B is 25 km from City C. How far is A from C?"
    GOOD (selfContained: true):  Use a geometry object so the app draws the shape.

  External ruler / measurement:
    BAD (selfContained: false):  "What measurement is shown by the arrow on the second ruler?"
    GOOD (selfContained: true):  { measurementTool: "ruler", geometry: { type: "segment", length: 3.5, ... } }

  External picture / image:
    BAD (selfContained: false):  "Look at the picture. How many birds are on the fence?"
    GOOD (selfContained: true):  "A fence has 5 birds. 2 fly away. How many are left?"

CONTEXT RULES — visual reference card shown above the question:
- Include a "context" object when the question references a set of items with values (prices, scores, lengths, tallies, temperatures, etc.) that are best shown as a compact reference rather than a long sentence
- The context card is rendered as a clean visual grid or table in the app — NO emojis
- Use "type": "grid" for items that have a label + value (most common — price tables, score charts, measurement lists)
- Use "type": "table" for multi-column comparisons (e.g. two groups being compared)
- For each item in a grid, pick ONE icon from this exact allowed list (use the name exactly as shown):
  TRANSPORT: car, bicycle, bus, train, airplane, boat, walk, rocket, subway
  ANIMALS/NATURE: paw, fish, bug, bird, egg, leaf, flower, rose, leaf, water, flame, snow
  WEATHER: rainy, sunny, partly-sunny, cloud, thunderstorm, umbrella, thermometer, moon
  SPACE: planet, globe, earth, telescope
  SCIENCE: flask, magnet, flash, bulb, prism, pulse, bandage, medkit, body, eye, ear
  PEOPLE: person, people, man, woman, baby, male, female
  SCHOOL/ART: book, school, pencil, backpack, library, clipboard, brush, color-palette, calculator, document
  AWARDS/SPORTS: medal, trophy, ribbon, star, podium, basketball, football, baseball, tennisball, golf, fitness, stopwatch
  FOOD: nutrition, pizza, fast-food, ice-cream, cafe, restaurant, cart
  MONEY/SHOPPING: cash, card, bag, gift, pricetag, receipt, wallet
  TIME: clock, time, hourglass, timer, calendar, alarm
  COMMUNITY/HOME: home, flag, storefront, key, map, compass, location, pin, newspaper
  MATH/SHAPES: cube, shapes, triangle, square, diamond, ellipse, infinite, pie-chart, bar-chart, stats-chart
  MUSIC: musical-note, musical-notes
  GENERAL FALLBACK: grid, layers, image
- If no icon fits, use "grid" as a safe fallback
- Omit "context" entirely if the question is self-contained and no reference card is needed (e.g. a pure fact question, vocabulary, grammar)

CONTEXT EXAMPLES:
Grid (price table):
{ "context": { "type": "grid", "title": "Toy Sale Prices", "items": [
  { "label": "Cat", "icon": "paw", "value": "10¢" },
  { "label": "Dog", "icon": "paw", "value": "15¢" },
  { "label": "Car", "icon": "car", "value": "20¢" },
  { "label": "Bike", "icon": "bicycle", "value": "8¢" }
]}}

Table (two groups):
{ "context": { "type": "table", "title": "Class Scores", "columns": ["Student","Score"], "rows": [["Amir","18"],["Bella","14"],["Carl","20"]] }}

WORKSHEET EXTRACTION RULES (highest priority):
- If the image shows a printed worksheet or problem set, your PRIMARY job is to faithfully reproduce those questions in digital form
- Keep the SAME numbers, items, names, and scenarios from the worksheet
- Use fill_in ONLY for math/number calculations (e.g. "How much do the car and bike cost together?" → fill_in, correctAnswer "28¢") — never fill_in for text answers
- Use ordering when the worksheet says "order from least to greatest" or similar
- Use true_false when the worksheet asks to evaluate a statement
- Use multiple_choice only when the worksheet itself provides answer choices
- DO NOT invent generic questions when specific questions are printed on the worksheet
- DO NOT simplify a calculation question into a "which is cheapest?" multiple-choice question
- When a question needs the price/data table, include a "context" grid object so the kid never needs the paper

RULER / MEASUREMENT WORKSHEET EXCEPTION — MANDATORY TRANSFORMATION:
- Ruler and protractor questions from worksheets almost always reference a physical diagram (e.g.
  "Read the arrow on ruler B", "What does the second ruler show?", "What unit is on this ruler?").
- You MUST NEVER copy that phrasing or concept. The app draws its own rulers — the student has no worksheet.
- INSTEAD, transform every such worksheet question using these rules:

  TYPE A — Ruler-reading questions (arrow, pointer, measurement shown):
    The correct answer changes per worksheet → ALWAYS replace with a ruler geometry question.
    Generate measurementTool:"ruler", invent a realistic length and bar color, include a geometry object.
    BAD: "What measurement is shown by the arrow?" / "Read the ruler and write the value."
    GOOD: { measurementTool:"ruler", geometry:{ type:"segment", length:3.5, unit:"inch", color:"blue", rulerMax:5 } }

  TYPE B — Unit identification questions ("What unit is on this ruler?"):
    CRITICAL: This question is answer-dependent even when rephrased cleanly.
    "What unit of measurement is used on this ruler?" with options [Centimeters, Inches, Meters, Feet]
    is STILL BROKEN — the correct answer is Inches on one worksheet and Centimeters on another.
    Cleaning up the phrasing does NOT fix this. You MUST replace with one of:
      Option 1 — General knowledge (always self-contained, never changes per worksheet):
        "What unit does a standard U.S. school ruler use?" → correct: Inches
        "What unit is used to measure short lengths on a metric ruler?" → correct: Centimeters
        Pick the option that matches the unit system visible on the scanned worksheet.
      Option 2 — Replace entirely with a ruler measurement question (measurementTool:"ruler").

  TYPE C — Comparative / ordering questions referencing specific rulers on the worksheet:
    ("Which ruler shows a longer measurement?" / "Which ruler goes up to 30?")
    The answer changes per worksheet → replace with a compare or difference ruler question using
    rulerSubtype:"compare" or rulerSubtype:"difference" with invented geometry.

- NEVER produce a question whose correct answer would be different on a different version of the worksheet.

VARIETY GUIDANCE:
- Mix types naturally. A math worksheet → fill_in for calculations, ordering for sequences, true_false for comparisons. A science/reading/social studies worksheet → multiple_choice or true_false for concepts, word_bank for vocabulary. Do NOT use fill_in outside of math. Do NOT force everything into multiple_choice.

Return ONLY this JSON and nothing else:
{
  "valid": true,
  "title": "Short descriptive title",
  "passage": "Optional reading passage — omit if not needed.",
  "questions": [
    {
      "selfContained": true,
      "context": { "type": "grid", "title": "Toy Sale Prices", "items": [
        { "label": "Cat", "icon": "paw", "value": "10¢" },
        { "label": "Dog", "icon": "paw", "value": "15¢" },
        { "label": "Car", "icon": "car", "value": "20¢" },
        { "label": "Bike", "icon": "bicycle", "value": "8¢" }
      ]},
      "type": "fill_in",
      "question": "How much do the car and bike cost together?",
      "hint": "Add the two prices.",
      "correctAnswer": "28¢",
      "acceptedAnswers": ["28¢","28 cents","28c"]
    },
    { "selfContained": true, "question": "Multiple choice — no context needed", "hint": "...", "options": ["A","B","C","D"], "correctIndex": 2 },
    { "selfContained": true, "type": "ordering", "question": "Order least to greatest: 15¢, 8¢, 20¢, 10¢", "hint": "...", "items": ["15¢","8¢","20¢","10¢"], "correctOrder": [1,3,0,2] },
    { "selfContained": true, "type": "true_false", "question": "1/2 > 3/4. True or False?", "hint": "...", "correctAnswer": false },
    { "selfContained": true, "type": "word_bank", "question": "The children ____ at school.", "hint": "...", "wordBank": ["am","is","are"], "correctAnswer": "are" }
  ]
}`;

const REGEN_SYSTEM_PROMPT = `You are a helpful educational assistant for children aged 5–12.

CONTENT RULES — these are absolute and must never be violated:
- All output must be completely appropriate for young children (ages 5–12)
- Never use profanity, crude language, slang, insults, or any offensive terms
- Never include violent, sexual, scary, or disturbing content of any kind
- Never reference drugs, alcohol, weapons, or adult themes
- Use simple, encouraging, and positive language at all times

You will be given an original question and asked to generate ONE replacement question on the same topic and difficulty. The replacement must be clearly different — different angle, different numbers, different phrasing, or different aspect of the same concept.

Match the SAME question type as the original. Use the correct JSON shape for that type:
- multiple_choice (no type field): { "question": "...", "hint": "...", "options": ["A","B","C","D"], "correctIndex": 0 }
- visual_mc: { "type": "visual_mc", "question": "...", "hint": "...", "options": [...], "correctIndex": 0 }
- fill_in: { "type": "fill_in", "question": "...", "hint": "...", "correctAnswer": "...", "acceptedAnswers": [...] }
- ordering: { "type": "ordering", "question": "...", "hint": "...", "items": [...], "correctOrder": [...] }
- true_false: { "type": "true_false", "question": "...", "hint": "...", "correctAnswer": true|false }
- word_bank: { "type": "word_bank", "question": "sentence with ____", "hint": "...", "wordBank": [...], "correctAnswer": "..." }
- number_line: { "type": "number_line", "question": "Place a point at X on the number line.", "hint": "...", "correctAnswer": "X", "geometry": { "min": 0, "max": 10, "step": 1, "target": X } }

SELF-CONTAINED RULE: the replacement must be answerable without any external materials. If the original had a "context" reference card, keep an equivalent context in the replacement.
If a "context" is needed, use this structure: { "type": "grid", "title": "...", "items": [{ "label": "...", "icon": "car|bicycle|paw|book|cash|flask|person|star|grid|...", "value": "..." }] }

For math shape/fraction questions you MAY include a "geometry" object (pie, bar, or shape).
Every question MUST include a "hint" field.

Return ONLY this JSON and nothing else:
{
  "question": { ... correct shape for the type ... }
}`;

// Server-side profanity guard — last line of defense before sending to client
const BANNED = [
  /\bf+u+c+k+\w*/gi, /\bs+h+i+t+\w*/gi, /\bb+i+t+c+h+\w*/gi,
  /\bc+u+n+t+\w*/gi, /\bd+i+c+k+\w*/gi,  /\bp+u+s+s+y+\w*/gi,
  /\bw+h+o+r+e+\w*/gi, /\bs+l+u+t+\w*/gi, /\bp+o+r+n+\w*/gi,
  /\bn+i+g+g+[ae]+\w*/gi, /\bf+a+g+g+o+t+\w*/gi,
];

function serverSanitize(text: string): string {
  let out = text;
  for (const p of BANNED) { out = out.replace(p, '[removed]'); p.lastIndex = 0; }
  return out;
}

function sanitizeQuestion(q: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    question: serverSanitize(String(q.question ?? '')),
    hint:     q.hint ? serverSanitize(String(q.hint)) : undefined,
  };

  // Type field (present for all non-default types)
  if (q.type) sanitized.type = q.type;

  // multiple_choice / visual_mc fields
  if (Array.isArray(q.options) && q.options.length > 0) {
    sanitized.options      = (q.options as string[]).map(serverSanitize);
    sanitized.correctIndex = q.correctIndex;
  }

  // fill_in fields
  if (q.correctAnswer !== undefined && q.type === 'fill_in') {
    sanitized.correctAnswer  = serverSanitize(String(q.correctAnswer));
    if (Array.isArray(q.acceptedAnswers)) {
      sanitized.acceptedAnswers = (q.acceptedAnswers as string[]).map(serverSanitize);
    }
  }

  // number_line fields
  if (q.type === 'number_line') {
    sanitized.correctAnswer = serverSanitize(String(q.correctAnswer ?? ''));
    if (Array.isArray(q.acceptedAnswers)) {
      sanitized.acceptedAnswers = (q.acceptedAnswers as string[]).map(serverSanitize);
    }
    if (q.mode) sanitized.mode = q.mode;
    // read + count modes need MC options
    if (Array.isArray(q.options)) {
      sanitized.options      = (q.options as string[]).map(serverSanitize);
      sanitized.correctIndex = q.correctIndex;
    }
  }

  // ordering fields
  if (q.type === 'ordering') {
    if (Array.isArray(q.items))        sanitized.items        = (q.items as string[]).map(serverSanitize);
    if (Array.isArray(q.correctOrder)) sanitized.correctOrder = q.correctOrder;
  }

  // true_false fields
  if (q.type === 'true_false') {
    sanitized.correctAnswer = q.correctAnswer; // boolean
  }

  // word_bank fields
  if (q.type === 'word_bank') {
    sanitized.correctAnswer = serverSanitize(String(q.correctAnswer ?? ''));
    if (Array.isArray(q.wordBank)) {
      sanitized.wordBank = (q.wordBank as string[]).map(serverSanitize);
    }
  }

  // Optional extras (selfContained is intentionally NOT forwarded — it's internal only)
  if (q.geometry)        sanitized.geometry        = q.geometry;
  if (q.image_ref)       sanitized.image_ref       = true;
  if (q.context)         sanitized.context         = q.context;
  if (q.measurementTool) sanitized.measurementTool = q.measurementTool;
  if (q.rulerMaxCm)      sanitized.rulerMaxCm      = q.rulerMaxCm;
  if (q.rulerSubtype)    sanitized.rulerSubtype     = q.rulerSubtype;

  return sanitized;
}

function sanitizeResponse(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.valid === false) {
    return { valid: false, reason: serverSanitize(String(obj.reason ?? '')) };
  }

  const raw = (obj.questions as Array<Record<string, unknown>> ?? []);

  // Log any questions GPT flagged or that slipped through without the field
  const dropped = raw.filter((q) => q.selfContained === false);
  const missing = raw.filter((q) => q.selfContained === undefined);
  if (dropped.length > 0) {
    console.warn(`[generate-questions] DROPPED ${dropped.length} question(s) marked selfContained:false:`);
    dropped.forEach((q, i) => console.warn(`  [${i + 1}] "${q.question}"`));
  }
  if (missing.length > 0) {
    console.warn(`[generate-questions] ${missing.length} question(s) missing selfContained field (kept, but investigate):`);
    missing.forEach((q, i) => console.warn(`  [${i + 1}] "${q.question}"`));
  }

  const questions = raw
    .filter((q) => q.selfContained !== false) // drop any GPT flagged as not self-contained
    .map(sanitizeQuestion);

  console.log(`[generate-questions] title="${obj.title}" raw=${raw.length} kept=${questions.length} dropped=${dropped.length} missingField=${missing.length}`);

  const result: Record<string, unknown> = {
    valid: true,
    title: serverSanitize(String(obj.title ?? '')),
    questions,
  };
  if (obj.passage && typeof obj.passage === 'string' && obj.passage.trim()) {
    result.passage = serverSanitize(obj.passage.trim());
  }
  return result;
}

// ── Independent self-containedness validator ─────────────────────────────────
// Uses gpt-4o-mini as a separate reviewer with no knowledge of the original
// generation. Returns a boolean per question — true = passes, false = drop.
// Fails open: if the validation call itself errors, all questions are kept.
// ── Number-line auto-enrichment ───────────────────────────────────────────────
// GPT frequently omits the `mode` field or uses place-mode for count/read questions.
// This function fixes what it can deterministically and DROPS the rest.
// It runs BEFORE Pass-2 so the validator sees the correct nlMode.

function parseFractionOrDecimal(s: string): number {
  const m = String(s ?? '').trim().match(/^(\d+)\/(\d+)$/);
  if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
  return parseFloat(String(s ?? ''));
}

function shuffleInPlace(arr: string[]): string[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function enrichNumberLineQuestions(
  questions: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];

  for (const q of questions) {
    if (q.type !== 'number_line') { out.push(q); continue; }

    const text = String(q.question ?? '').toLowerCase();
    const geo  = (q.geometry ?? {}) as Record<string, number>;
    const mode = String(q.mode ?? 'place');

    // ── 1. Count-mode detection & auto-enrichment ─────────────────────────────
    const isCountPattern = /how many (equal )?parts|how many sections|divided into.*parts/.test(text);

    if (isCountPattern && (!q.mode || mode === 'place')) {
      const min      = typeof geo.min  === 'number' ? geo.min  : 0;
      const max      = typeof geo.max  === 'number' ? geo.max  : 1;
      const rawStep  = typeof geo.step === 'number' && geo.step > 0 ? geo.step : 0.25;
      const numSteps = Math.min(Math.round((max - min) / rawStep), 20);

      if (numSteps > 0) {
        const correct    = numSteps;
        const pool = [correct - 2, correct - 1, correct + 1, correct + 2].filter((n) => n > 0 && n !== correct);
        const distractors = pool.slice(0, 3);
        while (distractors.length < 3) distractors.push(correct + distractors.length + 3);
        const opts = shuffleInPlace([String(correct), ...distractors.slice(0, 3).map(String)]);
        const correctIndex = opts.indexOf(String(correct));
        // Normalize question text — remove worksheet-specific language for Pass-2
        const cleanQ = 'The number line below is divided into equal parts. How many equal parts does it have?';
        console.info(`[generate-questions] Auto-enriched count mode: "${q.question}" → ${correct} parts`);
        out.push({ ...q, question: cleanQ, mode: 'count', options: opts, correctIndex, correctAnswer: String(correct), selfContained: true });
        continue;
      }
      // If we couldn't compute numSteps, drop — can't render sensibly
      console.warn(`[generate-questions] Dropping count-pattern NL (bad geometry): "${q.question}"`);
      continue;
    }

    // ── 2. Read-mode detection & auto-enrichment ──────────────────────────────
    // These patterns mean the student must identify an already-placed point.
    const isReadPattern = /what fraction|name of the point|name.*point|what.*point.*represent|frog represent|dot represent|point.*shown|value.*marked|marked.*value/.test(text);

    if (isReadPattern && (!q.mode || mode === 'place')) {
      // We MUST have options to render read mode — drop if absent
      if (!Array.isArray(q.options) || q.options.length === 0) {
        console.warn(`[generate-questions] Dropping read-pattern NL (no options — unrenderable as place): "${q.question}"`);
        continue;
      }

      // Resolve the target position from correctAnswer or the correct option
      let target = typeof geo.target === 'number' ? geo.target : NaN;
      if (isNaN(target)) target = parseFractionOrDecimal(String(q.correctAnswer ?? ''));
      if (isNaN(target) && typeof q.correctIndex === 'number') {
        target = parseFractionOrDecimal((q.options as string[])[q.correctIndex as number] ?? '');
      }

      if (!isNaN(target)) {
        // Normalize question text — strip worksheet-specific nouns (frog, purple dot, etc.)
        // Replace with neutral "a point is marked" phrasing so Pass-2 never sees "the frog"
        const cleanQ = 'A point is marked on the number line below. What fraction does it represent?';
        const updatedGeo = { ...geo, target };
        console.info(`[generate-questions] Auto-enriched read mode: "${q.question}" → target=${target}`);
        out.push({ ...q, question: cleanQ, mode: 'read', geometry: updatedGeo, selfContained: true });
        continue;
      }

      // Has options but no parseable target — drop (can't place the dot)
      console.warn(`[generate-questions] Dropping read-pattern NL (no parseable target): "${q.question}"`);
      continue;
    }

    // ── 3. Explicit read mode without options → drop ──────────────────────────
    if (mode === 'read' && !Array.isArray(q.options)) {
      console.warn(`[generate-questions] Dropping read-mode NL (no options): "${q.question}"`);
      continue;
    }

    // ── 4. GPT already set mode:"count" — validate geometry matches answer ────
    // If step draws 5 sections but correctAnswer says 4, fix the step so the
    // drawn number line is consistent with what the student needs to select.
    if (mode === 'count') {
      const min       = typeof geo.min  === 'number' ? geo.min  : 0;
      const max       = typeof geo.max  === 'number' ? geo.max  : 1;
      const rawStep   = typeof geo.step === 'number' && geo.step > 0 ? geo.step : 0.25;
      const numSteps  = Math.min(Math.round((max - min) / rawStep), 20);
      const claimed   = parseInt(String(q.correctAnswer ?? '0'), 10);

      if (!isNaN(claimed) && claimed > 0 && numSteps !== claimed) {
        const fixedStep = (max - min) / claimed;
        console.info(`[generate-questions] Fixed count-mode geometry step: ${rawStep} → ${fixedStep} (numSteps ${numSteps} → ${claimed})`);
        out.push({ ...q, geometry: { ...geo, step: fixedStep } });
        continue;
      }
    }

    out.push(q);
  }

  return out;
}

async function validateSelfContained(
  questions: Array<Record<string, unknown>>,
  openaiKey: string,
): Promise<boolean[]> {
  if (questions.length === 0) return [];

  const items = questions.map((q, i) => ({
    i,
    q: String(q.question ?? ''),
    hasContext:  !!q.context,
    hasGeometry: !!q.geometry,
    // "read" mode = app draws a pre-placed dot (self-contained); "place" mode = student drags, no dot shown
    nlMode: String(q.mode ?? (q.type === 'number_line' ? 'place' : '')),
  }));

  const validationPrompt = `You are a strict quality-control checker for children's educational quiz questions.

For each question, answer ONE thing: can a child answer it correctly using ONLY what the app shows
them — with NO access to any worksheet, image, diagram, or external material?

RULE 0 — UNCONDITIONAL OVERRIDE (check this first before anything else):
If nlMode="count" → ALWAYS return ok:true. No further checks needed.
If nlMode="read"  → ALWAYS return ok:true. No further checks needed.
The server has already verified geometry, options, and target for these modes.

RULE 1 — place mode (nlMode="place" or nlMode="" ):
  ✅ PASS: question explicitly names a target value — "Place a point at 3/4", "Mark 14", "Where does 0.5 go?"
  ❌ FAIL: question asks the student to read/identify/count an existing marker or parts

RULE 2 — other geometry (rulers, angles, protractors):
  hasGeometry=true means the app draws the tool. ✅ PASS.

RULE 3 — no geometry, text-only questions:
  ✅ PASS: answerable from text alone with no external materials
  ❌ FAIL: references an unseen visual ("this diagram", "the chart", "shown above")
  ❌ FAIL: ordinal worksheet reference ("the third number line", "the second row")

Return ONLY a JSON array — one object per input, same order:
[{"i":0,"ok":true},{"i":1,"ok":false},...]`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0,
        messages: [
          { role: 'system', content: validationPrompt },
          { role: 'user',   content: JSON.stringify(items) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`validation HTTP ${res.status}`);

    const json    = await res.json();
    const text    = json.choices?.[0]?.message?.content ?? '';
    const match   = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('no JSON array in validation response');

    const results = JSON.parse(match[0]) as Array<{ i: number; ok: boolean }>;
    const okMap   = new Map(results.map((r) => [r.i, r.ok !== false]));
    return questions.map((_, idx) => okMap.get(idx) ?? true); // default allow if missing
  } catch (err) {
    console.warn('[generate-questions] Validation pass failed, allowing all through:', (err as Error).message);
    return questions.map(() => true);
  }
}

const MAX_SCANS_PER_DAY = 20;

function parseJwtUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    const userId = parseJwtUserId(jwt);

    const body = await req.json();

    // ── Regenerate single question mode ────────────────────────
    if (body.regenerate === true) {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API key not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageList: string[] = body.images
        ? (Array.isArray(body.images) ? body.images : [body.images])
        : [];

      const userContent: unknown[] = imageList.map((b64) => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
      }));

      const isVisual = body.isVisual === true;
      userContent.push({
        type: 'text',
        text: `Original question to replace: "${body.existingQuestion ?? ''}"\n\nGenerate ONE replacement question on the same topic. isVisual: ${isVisual}`,
      });

      const regenResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 800,
          messages: [
            { role: 'system', content: REGEN_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
        }),
      });

      if (!regenResponse.ok) {
        const err = await regenResponse.text();
        throw new Error(`OpenAI error: ${err}`);
      }

      const regenData = await regenResponse.json();
      const regenContent = regenData.choices?.[0]?.message?.content ?? '';
      const jsonMatch = regenContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI did not return valid JSON. Please try again.');
      const parsed = JSON.parse(jsonMatch[0]);
      const sanitizedQ = sanitizeQuestion(parsed.question ?? parsed);

      return new Response(
        JSON.stringify({ question: sanitizedQ }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Rate limiting (full generation only) ──────────────────
    if (userId) {
      const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey  = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .gte('scanned_at', todayStart.toISOString());

      if ((count ?? 0) >= MAX_SCANS_PER_DAY) {
        return new Response(
          JSON.stringify({ error: `Daily scan limit reached (${MAX_SCANS_PER_DAY}/day). Try again tomorrow.` }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Accept `images` array (new) or legacy `imageBase64` string
    const imageList: string[] = body.images
      ? (Array.isArray(body.images) ? body.images : [body.images])
      : body.imageBase64
        ? [body.imageBase64]
        : [];

    // Accept new array format OR legacy single-image field
    type VisualItem = { base64: string; questionCount: number };
    const rawVisuals: VisualItem[] = Array.isArray(body.visualImages)
      ? body.visualImages
      : body.visualImage
        ? [{ base64: body.visualImage, questionCount: imageVisualCount(Math.min(Math.max(Number(body.questionCount) || 9, 5), 20)) }]
        : [];

    const questionCount: number = Math.min(Math.max(Number(body.questionCount) || 9, 5), 20);
    const numImageVisual = rawVisuals.reduce((sum, v) => sum + (v.questionCount ?? 1), 0);

    if (imageList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload all visual aid images to Supabase Storage
    const visualUrls: string[] = [];
    if (rawVisuals.length > 0) {
      const supabaseUrl   = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      await supabaseAdmin.storage.createBucket('lesson-visuals', { public: true }).catch(() => {});

      for (let vi = 0; vi < rawVisuals.length; vi++) {
        const b64 = rawVisuals[vi].base64;
        try {
          const binaryStr = atob(b64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

          const storagePath = `${userId ?? 'anon'}/${Date.now()}-${vi}.jpg`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('lesson-visuals')
            .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false });

          if (!uploadError) {
            const { data: urlData } = supabaseAdmin.storage
              .from('lesson-visuals').getPublicUrl(storagePath);
            visualUrls.push(urlData.publicUrl);
          } else {
            visualUrls.push('');
          }
        } catch {
          visualUrls.push('');
        }
      }
    }

    // Build user message: all page images + optional visual aid images + text prompt
    const userContent: unknown[] = imageList.map((b64) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
    }));

    // Append each visual aid image at the end
    for (const v of rawVisuals) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${v.base64}`, detail: 'high' },
      });
    }

    const pageText = imageList.length > 1
      ? `These are ${imageList.length} pages from the same lesson. Generate exactly ${questionCount} practice questions spread evenly across all pages.`
      : `Generate exactly ${questionCount} practice questions from this page.`;

    let visualAidInstruction = '';
    if (rawVisuals.length > 0) {
      const totalVisualQs = rawVisuals.reduce((s, v) => s + (v.questionCount ?? 1), 0);
      const perImageInstructions = rawVisuals.map((v, i) =>
        `Visual Aid ${i + 1} (image at position ${imageList.length + i + 1}): generate exactly ${v.questionCount ?? 1} question(s), mark each with "image_ref": ${i + 1}`
      ).join('. ');
      visualAidInstruction = ` The LAST ${rawVisuals.length} image(s) are visual aids the parent photographed from the same lesson — they are NOT text pages. ${perImageInstructions}. CRITICAL for visual aid questions: you have already read the lesson text pages — use that topic and vocabulary as your anchor. Ask questions that use the image as evidence for a concept from the lesson (e.g. if the lesson is about traits, ask how the image illustrates an inherited or learned trait). Do NOT ask trivial identification questions like "what animal is shown" or "what colour is this" — the question must connect the image to a concept from the lesson text. Reference "the image shown" or "the diagram above" in the question text. The remaining ${questionCount - totalVisualQs} questions come from the text pages only.`;
    }

    userContent.push({
      type: 'text',
      text: `${pageText}${visualAidInstruction} Every question must include a "hint" field. WORKSHEET EXTRACTION PRIORITY: if the image shows a worksheet or problem set, base the questions as closely as possible on the ACTUAL questions printed on the worksheet — same numbers, same scenarios, same level of difficulty. Do NOT simplify or restate the questions in a generic way. Use fill_in ONLY for math/number calculations, ordering for sequence questions, true_false for comparisons, word_bank for vocabulary/grammar, multiple_choice for all other text-based answers. CRITICAL: visual_mc is ONLY for emoji/symbol pattern sequences (like colour patterns or shape sequences). NEVER use visual_mc for reading comprehension, main idea, vocabulary, science concepts, or any question whose answer is a word or sentence — use regular multiple_choice with text answers instead.`,
    });

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 8000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
        }),
    });

    if (!openaiResponse.ok) {
      const err = await openaiResponse.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON. Please try again.');
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // ── Pass 1 logging: what did GPT declare about each question? ────────────
    if (Array.isArray(parsed.questions)) {
      console.log(`[generate-questions] GPT returned ${parsed.questions.length} question(s) for "${parsed.title}":`);
      (parsed.questions as Array<Record<string, unknown>>).forEach((q, i) => {
        const sc   = q.selfContained;
        const flag = sc === false ? '❌ NOT self-contained' : sc === true ? '✅' : '⚠️  missing selfContained';
        console.log(`  [${i + 1}] ${flag} | type=${q.type ?? 'mc'} | "${q.question}"`);
      });
    }

    // ── Auto-enrich number_line questions before Pass-2 ──────────────────────
    // Converts count-pattern questions to mode:"count" with auto-generated MC options.
    // Drops read-mode questions that are missing options (unrenderable).
    if (Array.isArray(parsed.questions)) {
      parsed.questions = enrichNumberLineQuestions(parsed.questions as Array<Record<string, unknown>>);
    }

    // ── Pass 2: independent validation via gpt-4o-mini ───────────────────────
    // GPT-4o sometimes marks externally-dependent questions as selfContained:true.
    // A second, stateless model reviews just the question texts with no prior context.
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      const qs      = parsed.questions as Array<Record<string, unknown>>;
      const allowed = await validateSelfContained(qs, openaiKey);
      const before  = qs.length;
      parsed.questions = qs.filter((_, i) => allowed[i]);
      const dropped2 = qs.filter((_, i) => !allowed[i]);
      if (dropped2.length > 0) {
        console.warn(`[generate-questions] PASS-2 dropped ${dropped2.length} question(s) GPT mislabelled as self-contained:`);
        dropped2.forEach((q, i) => console.warn(`  [${i + 1}] "${q.question}"`));
      }
      console.log(`[generate-questions] Pass-2 result: ${before} → ${parsed.questions.length} questions kept`);

      // If every question was dropped, return a validation failure rather than an empty lesson
      if (parsed.questions.length === 0) {
        console.warn('[generate-questions] All questions failed Pass-2 — worksheet is too visually dependent to digitize');
        return new Response(
          JSON.stringify({
            valid: false,
            reason: 'Every question on this worksheet refers to a diagram or visual that the app cannot reproduce. Try a worksheet where the questions can stand on their own — for example, one with written problems, sequences, or vocabulary rather than diagrams to read.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── Retry pass: fill the gap if Pass-2 dropped some questions ────────────
      // One attempt only — no infinite loops.
      const shortfall = questionCount - (parsed.questions as Array<Record<string, unknown>>).length;
      if (shortfall > 0) {
        console.log(`[generate-questions] Shortfall of ${shortfall} — attempting retry pass`);
        try {
          const coveredTopics = (parsed.questions as Array<Record<string, unknown>>)
            .map((q) => String(q.question ?? '').slice(0, 80))
            .join(' | ');

          const retryContent: unknown[] = imageList.map((b64) => ({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
          }));
          retryContent.push({
            type: 'text',
            text: `Generate exactly ${shortfall} MORE practice questions from this page. Every question must include a "hint" field. IMPORTANT: do NOT repeat any of these already-covered topics: ${coveredTopics}. Focus on parts of the worksheet not yet covered. Apply all the same rules as before (self-contained, correct type/mode, etc.).`,
          });

          const retryResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o',
              max_tokens: 4000,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: retryContent },
              ],
            }),
          });

          if (retryResp.ok) {
            const retryData  = await retryResp.json();
            const retryText  = retryData.choices?.[0]?.message?.content ?? '';
            const retryMatch = retryText.match(/\{[\s\S]*\}/);
            if (retryMatch) {
              const retryParsed = JSON.parse(retryMatch[0]);
              let retryQs = (retryParsed.questions as Array<Record<string, unknown>> ?? []);
              retryQs = enrichNumberLineQuestions(retryQs);
              const retryAllowed = await validateSelfContained(retryQs, openaiKey);
              const retryKept   = retryQs.filter((_, i) => retryAllowed[i]);
              console.log(`[generate-questions] Retry kept ${retryKept.length} / ${retryQs.length} question(s)`);
              (parsed.questions as Array<Record<string, unknown>>).push(...retryKept.slice(0, shortfall));
            }
          }
        } catch (retryErr) {
          console.warn('[generate-questions] Retry pass failed (non-fatal):', (retryErr as Error).message);
        }
      }
    }

    const safe = sanitizeResponse(parsed);

    // Log the scan for rate limiting (fire-and-forget)
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      supabase.from('scan_logs').insert({ user_id: userId }).then(() => {});
    }

    const responseBody = visualUrls.length > 0
      ? { ...safe, visual_urls: visualUrls, visual_url: visualUrls[0] } // visual_url for backwards compat
      : safe;

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
