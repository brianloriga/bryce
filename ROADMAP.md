# SnapStudy iOS App Roadmap

> **Goal:** A native iOS app where parents photograph textbook pages and AI generates practice questions for their kids. Free during beta; subscription monetization added last.

---

## Architecture: Standard vs Enhanced Questions

SnapStudy questions fall into two categories. The distinction determines how much the AI controls vs how much the developer controls.

### Standard Questions
AI has full creative control over content and format. These types are reliable and working today.

| Type | Description |
| --- | --- |
| `multiple_choice` | A/B/C/D tap cards |
| `fill_in` | Student types a free-text answer |
| `true_false` | Large True / False buttons |
| `word_bank` | Tap a word chip to fill a blank |
| `ordering` | Drag chips into the correct sequence |

### Enhanced Questions (Tool Framework)

The developer pre-builds the complete UI shell, interaction layer, and validation model. The AI's only job is to **classify** the question type and **extract data** into a rigid, developer-defined schema. If the AI cannot confidently match a tool schema, it falls back to a standard type.

This replaces the old approach where AI invented rendering schemas on the fly — which caused dropped fields, NaN values, and chains of client-side repair code.

```
Scan flow:
    Scanned images → Edge Function
        → AI classifies question type
        → Does a pre-built tool exist for it?
                YES → AI extracts data into the tool's fixed schema
                NO  → AI generates as standard question type
        → Return mixed array of standard + enhanced questions

Quiz rendering:
    For each question:
        → toolType present and registered? → use pre-built tool renderer
        → otherwise                        → use standard renderer
```

See [TOOLS.md](./TOOLS.md) for the full design spec of each tool.

---

## Current Status

| Phase | Description | Status |
| --- | --- | --- |
| 1 | Expo foundation, navigation shell, WebView embed | Done |
| 2 | Supabase auth, kid profiles, progress sync | Done |
| 3 | Camera + AI question generation pipeline | Done (3.7 pending) |
| 5 | COPPA compliance, onboarding, haptics, app icon | Done (device testing pending) |
| 7A | Bug fixes — zero-question guard, PIN cleanup, correctIndex clamping | Done |
| 7B | Security — rate limiting, secure PIN storage, console.log cleanup | Done |
| 7C | UX polish — lesson rename, keyboard fix, avatar system, dark/light theme | Done |
| 7D | Engagement — quiz results saved, parent progress dashboard | Done (streaks/push pending) |
| **Tool Framework** | **Enhanced question tools, design-first build order** | **In Progress** |
| 3.7 | Custom lessons visible in the child's game (WebView bridge) | Pending |
| 5.6 / 5.7 | Real device testing via TestFlight, screen size fixes | Pending |
| 6 | App Store launch | Pending |
| 8 | Boss battles, mini-games, a la carte purchases | Pending |
| 4 | Subscriptions (RevenueCat + Apple IAP) | Last |

---

## Completed Feature Highlights

- Multi-page scanning (up to 6 pages), visual aid slots, image resize pipeline
- AI content validation — rejects non-educational images automatically
- 5 standard question types with full ScanScreen review editors
- Rich questions: hints, markdown rendering, emoji visuals, geometry display
- Per-question regenerate without re-scanning
- Reading passage modal (Read Along)
- Subject category system (Reading, Math, Science, Social Studies + custom)
- Dark / light theme system, colour + initial kid avatars, edit profile modal
- Parent progress dashboard (quiz history, stats, per-lesson progress bars)
- Self-contained question guardrails + ContextCard reference panel
- Per-user rate limiting on the edge function (20 scans/day)
- COPPA-compliant privacy policy and terms of service screens
- Parental consent gate on signup, parent PIN lock on Account tab
- **Number Line** — 5 interactive modes (read, place, missing, partition, distance); snap-to-tick, no live readout, staged thinking, negative number support
- **Coordinate Grid** — 6 interactive modes (plot, read, multi_plot, missing, quadrant, error_detect); snap-to-intersection, floating x/y label during drag, x/y steppers for coordinate entry, error detection with avatar character cards and animated step transitions

---

## Enhanced Tool Framework — Build Order

Each tool is designed before a line of code is written. The process for every tool:

1. **Mockup** — parent provides a design or description of the tool UI
2. **Spec** — schema, interaction modes, and validation rules documented in TOOLS.md
3. **Shell** — UI component built and interactive, with no AI dependency
4. **Wire** — edge function updated to classify + extract data into the tool's schema
5. **QA** — scan a real worksheet; verify the tool renders correctly end-to-end

### Math Tools

| # | Tool | Subject / Grade | Status |
| --- | --- | --- | --- |
| 1 | **Protractor** | Math, Geometry, Grades 4-8 | Done — all 5 modes live |
| 2 | **Ruler** | Math, Grades 1-6 | Done — all 4 subtypes live, MC pedagogical redesign complete |
| 2b | **Measuring Cup** | Math, Grades 1-4 | Done — all 3 modes live (read, fill, compare) |
| 3 | **Number Line** | Math, Grades 1-8 | Done — 5 modes live (read, place, missing, partition, distance) |
| 4 | **Analog Clock** | Math, Grades 1-3 | Done — all 4 modes live |
| 5 | **Coin / Money** | Math, Grades 1-3 | Done — all 5 modes live |
| 6 | **Coordinate Grid** | Math, Grades 4-8 | Done — 6 modes live (plot, read, multi_plot, missing, quadrant, error_detect) |
| 7 | **Fraction Bar** | Math, Grades 3-5 | Done — 4 modes live |
| 8 | **Fraction Number Line** | Math, Grades 3-5 | Done — 3 modes live |
| 9 | **Build-a-Fraction** | Math, Grades 4-5 | Done — build mode live |
| T3-C | **Mixed Representation Match** | Math, Grades 4-6 | Specced — Not Built |
| T3-D | **Improper Fractions & Mixed Numbers** | Math, Grades 5-6 | Specced — Not Built |
| T3-E | **Decimal-Fraction Bridge** | Math, Grades 5-6 | Specced — Not Built |

### Science, Reading & Social Studies Tools — Tier 1 (Build Next)

These five tools have the highest cross-subject reuse and lowest build risk. Two (Chart Reader, Timeline) were already in the original roadmap.

| # | Tool | Subject / Grade | Status |
| --- | --- | --- | --- |
| S1 | **Classification Sort** | Science, Social Studies, Reading, Math — Grades 2-6 | Done — two_way + three_way modes live |
| S2 | **Cause & Effect Mapper** | Reading, Science, Social Studies — Grades 2-6 | Specced — Pending Mockup |
| S3 | **Chart Reader** (Bar / Line) | Science, Social Studies, Math — Grades 3-8 | Specced — Pending Mockup |
| S4 | **Timeline Builder** | Social Studies, Science, Reading — Grades 3-8 | Specced — Pending Mockup |
| S5 | **Diagram Labeler** | Science — Grades 3-8 | Specced — Pending Mockup |

### Science, Reading & Social Studies Tools — Tier 2

| # | Tool | Subject / Grade | Status |
| --- | --- | --- | --- |
| S6 | **Context Clues Highlighter** | Reading / ELA — Grades 2-6 | Specced — Pending Mockup |
| S7 | **Venn Diagram Sorter** | Reading, Science, Social Studies — Grades 2-6 | Specced — Pending Mockup |
| S8 | **Life Cycle Sequencer** | Science — Grades 2-5 | Specced — Pending Mockup |
| S9 | **Map Labeler** | Social Studies — Grades 3-8 | Specced — Pending Mockup |

### Science, Reading & Social Studies Tools — Tier 3

| # | Tool | Subject / Grade | Status |
| --- | --- | --- | --- |
| S10 | **Main Idea Web** | Reading / ELA — Grades 2-5 | Specced — Pending Mockup |
| S11 | **Food Chain Builder** | Science — Grades 3-6 | Specced — Pending Mockup |
| S12 | **Parts of Speech Tagger** | Reading / ELA — Grades 2-5 | Specced — Pending Mockup |

> When a tool is not yet built, the edge function falls back to the best-matching standard question type. No questions are lost — they just render without the interactive tool.

---

## Generation Pipeline — Optimization & Cleanup (Pending)

### In Progress / Recently Shipped
- Parallel GPT-4o calls: one text track + one isolated call per visual aid (eliminates cross-contamination)
- Visual aid questions are now additive to the standard question count
- Pass-2 validator pre-filter (TypeScript) skips LLM check for obviously self-contained questions
- `image_ref` numeric index preserved through sanitization pipeline (fixes wrong-image bug)
- Dynamic generating screen with elapsed timer and progressive stage messages
- Dev logging via AsyncStorage (visible in Dev tab)

### Pending Validation
- **Test low-detail lesson pages in visual aid calls** — Lesson pages are sent at `detail:'low'` in VA GPT calls (topic context only; VA image itself stays `detail:'high'`). This cuts per-scan cost by ~35%. Validate across 3–5 scans with dense-text and vocabulary-heavy lessons to confirm VA question vocabulary quality is not degraded. If quality drops, fall back to sending only the lesson title as a text string instead of low-detail images.

### Pending Cleanup
- **Clean up all development logging** — Remove or gate all `devLogger` calls, AsyncStorage log entries, and `console.log`/`console.warn` statements in the edge function before App Store submission. Replace with a structured, production-safe logging strategy (e.g., Supabase audit table or edge function metrics only).

---

## Prompt Scalability — Two-Pass Architecture (Trigger: ~20 tools)

### Current approach (single-pass)
Every scan sends one large system prompt containing all tool schemas to GPT-4o. GPT classifies the question type and extracts schema data in the same call. This works well today — the current prompt is well within GPT-4o's 128k context window and tools have distinct, non-overlapping trigger patterns.

### The concern
As the tool registry grows past ~20 entries, the single-pass approach risks:
1. **Attention dilution** — GPT begins confusing similar tools (e.g. Classification Sort vs. Venn Diagram vs. Cause & Effect) or misses the right one
2. **Prompt cost** — every scan pays for the full tool-menu token count regardless of how many tools are actually relevant to the worksheet

### The fix (when needed)
Split generation into two passes:

```
Pass 1 — classify (cheap, text-only, no images):
  Input:  question text only + a compact tool-menu list (one line per tool)
  Output: ["classification_sort", "fill_in", "clock"]  ← just the types needed

Pass 2 — extract (one call per matched tool):
  Input:  worksheet image + only the matching tool's full schema rules
  Output: the complete structured question JSON
```

This mirrors the existing visual-aid parallel-call pattern (already in production) and keeps each extraction call small and focused.

### When to implement
Build this when the Tier 2 Science/Reading/SS tools (S6–S9) are complete and the total tool count reaches ~20. At that point the single-pass prompt becomes unwieldy and the two-pass design pays for itself in both accuracy and cost.

---

## Guardrails & Storage Limits (7E) — Pending

- Kid profile cap (max 6 per account)
- Lesson cap per account (30 free tier)
- Lesson delete confirmation (swipe or long-press)
- Auto-archive lessons not played in 90 days
- Storage usage indicator in AccountScreen
- Orphaned asset cleanup (audio + visual aid buckets)

---

## Deferred: Engagement & Retention (7D remainder)

- Streak tracking — reward kids for consecutive study days
- Push notifications — optional daily reminder per kid
- Offline mode — cache units locally for no-Wi-Fi play
- Lesson sharing — share a unit with another SnapStudy family

---

## Phase 8 — Boss Battles & Mini-Games (Deferred)

After App Store launch. Boss battles unlock after 2+ star quiz completion; mini-games (Word Scramble, Flash Cards, Speed Round, Match-Up, Memory Flip) are parent-assignable rewards per lesson. Individual games purchasable a la carte via IAP.

---

## Phase 4 — Subscriptions (Last)

RevenueCat + Apple IAP. Free tier plays all built-in content; paid tier ($7.99/mo) unlocks AI scanning and unlimited custom lessons. Deferred until all functionality is validated end-to-end in beta.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Mobile app | Expo (React Native) |
| Auth + Database | Supabase (Postgres, Edge Functions, Storage) |
| AI vision | OpenAI GPT-4o Vision |
| Subscriptions | RevenueCat (deferred) |

---

See [CHANGELOG.md](./CHANGELOG.md) for the detailed progress log.

See [TOOLS.md](./TOOLS.md) for the design spec of every Enhanced tool.
