// @ts-nocheck
// Number-line auto-enrichment, draw-angle upgrade, and Pass-2 self-containedness validation.

// ── Draw-angle auto-upgrade ────────────────────────────────────────────────
// Catches plain fill_in questions like "Draw a 160° angle at point P." that GPT
// forgot to attach a measurementTool to, and upgrades them to protractor build
// mode so the child gets an interactive draggable arm instead of a confusing text box.
export function enrichDrawAngleQuestions(
  questions: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  // Two letters for the ray ends, guaranteed different from vertex and each other
  function pickRays(vertex: string): [string, string] {
    const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('').filter((l) => l !== vertex);
    const i1 = Math.floor(Math.random() * pool.length);
    let i2 = Math.floor(Math.random() * (pool.length - 1));
    if (i2 >= i1) i2++;
    return [pool[i1], pool[i2]];
  }

  return questions.map((q) => {
    // Only act on plain fill_in questions that have no measurement tool yet
    if (q.type !== 'fill_in' || q.measurementTool) return q;

    const text = String(q.question ?? '');
    // Match: "Draw/Construct/Sketch a 160° angle [at point P]"
    const match = text.match(
      /^(?:draw|construct|sketch)\s+a[n]?\s+(\d+)\s*°?\s+angle(?:\s+at\s+point\s+([A-Z]))?/i,
    );
    if (!match) return q;

    const angleDeg = parseInt(match[1], 10);
    if (isNaN(angleDeg) || angleDeg <= 0 || angleDeg >= 180) return q;

    const vertex = match[2] ?? 'P';
    const [ray1, ray2] = pickRays(vertex);
    const flipped = Math.random() > 0.5;

    console.info(
      `[generate-questions] Auto-upgraded draw-angle to protractor build: "${text}" → ${angleDeg}° vertex=${vertex}`,
    );

    return {
      ...q,
      question:        `Draw a ${angleDeg}° angle at point ${vertex}.`,
      measurementTool: 'protractor',
      correctAnswer:   String(angleDeg),
      acceptedAnswers: [String(angleDeg), `${angleDeg}°`],
      selfContained:   true,
      geometry: {
        type:          'angle',
        angleDeg,
        vertex,
        ray1,
        ray2,
        flipped,
        ...(flipped ? { scaleOrigin: 'left' } : {}),
        protractorMode: 'build',
      },
    };
  });
}

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

// GPT frequently omits the `mode` field or uses place-mode for count/read questions.
// This function fixes what it can deterministically and drops the rest.
// It runs BEFORE Pass-2 so the validator sees the correct nlMode.
export function enrichNumberLineQuestions(
  questions: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];

  for (const q of questions) {
    if (q.type !== 'number_line') { out.push(q); continue; }

    const text = String(q.question ?? '').toLowerCase();
    const geo  = (q.geometry ?? {}) as Record<string, number>;
    const mode = String(q.mode ?? 'place');

    // ── 1. Count-mode detection & auto-enrichment ─────────────
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
        const cleanQ = 'The number line below is divided into equal parts. How many equal parts does it have?';
        console.info(`[generate-questions] Auto-enriched count mode: "${q.question}" → ${correct} parts`);
        out.push({ ...q, question: cleanQ, mode: 'count', options: opts, correctIndex, correctAnswer: String(correct), selfContained: true });
        continue;
      }
      console.warn(`[generate-questions] Dropping count-pattern NL (bad geometry): "${q.question}"`);
      continue;
    }

    // ── 2. Read-mode detection & auto-enrichment ──────────────
    const isReadPattern = /what fraction|name of the point|name.*point|what.*point.*represent|frog represent|dot represent|point.*shown|value.*marked|marked.*value/.test(text);
    if (isReadPattern && (!q.mode || mode === 'place')) {
      if (!Array.isArray(q.options) || q.options.length === 0) {
        console.warn(`[generate-questions] Dropping read-pattern NL (no options — unrenderable as place): "${q.question}"`);
        continue;
      }
      let target = typeof geo.target === 'number' ? geo.target : NaN;
      if (isNaN(target)) target = parseFractionOrDecimal(String(q.correctAnswer ?? ''));
      if (isNaN(target) && typeof q.correctIndex === 'number') {
        target = parseFractionOrDecimal((q.options as string[])[q.correctIndex as number] ?? '');
      }
      if (!isNaN(target)) {
        const cleanQ = 'A point is marked on the number line below. What fraction does it represent?';
        const updatedGeo = { ...geo, target };
        console.info(`[generate-questions] Auto-enriched read mode: "${q.question}" → target=${target}`);
        out.push({ ...q, question: cleanQ, mode: 'read', geometry: updatedGeo, selfContained: true });
        continue;
      }
      console.warn(`[generate-questions] Dropping read-pattern NL (no parseable target): "${q.question}"`);
      continue;
    }

    // ── 3. Explicit read mode without options → drop ──────────
    if (mode === 'read' && !Array.isArray(q.options)) {
      console.warn(`[generate-questions] Dropping read-mode NL (no options): "${q.question}"`);
      continue;
    }

    // ── 4. GPT already set mode:"count" — validate geometry ───
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

// ── Independent self-containedness validator ───────────────────
// Uses gpt-4o-mini as a separate reviewer with no knowledge of the
// original generation. Fails open: if the call errors, all pass.
export async function validateSelfContained(
  questions: Array<Record<string, unknown>>,
  openaiKey: string,
): Promise<boolean[]> {
  if (questions.length === 0) return [];

  const items = questions.map((q, i) => ({
    i,
    q: String(q.question ?? ''),
    hasContext:  !!q.context,
    hasGeometry: !!q.geometry,
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
        max_tokens: 600,
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
    return questions.map((_, idx) => okMap.get(idx) ?? true);
  } catch (err) {
    console.warn('[generate-questions] Validation pass failed, allowing all through:', (err as Error).message);
    return questions.map(() => true);
  }
}
