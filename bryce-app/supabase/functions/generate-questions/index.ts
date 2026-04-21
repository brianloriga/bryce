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
   - Use ONLY when the worksheet does NOT provide specific numbers or scenarios to extract, AND a visual/emoji representation would genuinely help a child understand the concept
   - Do NOT use visual_mc to "decorate" a question that already has clear numbers or text on the worksheet — use fill_in or true_false instead
   - Examples where visual_mc is appropriate: a blank pattern like 🔴🔵🔴❓, a counting exercise with no specific numbers given, an abstract concept with no worksheet text
   - Examples where visual_mc is WRONG: the worksheet says "How much does the car and bike cost together?" → use fill_in; the worksheet says "8¢ + 20¢ = ?" → use fill_in
   { "type": "visual_mc", "question": "🔴🔵🔴🔵❓ What comes next?", "hint": "...", "options": ["🔴","🔵","🟡","🟢"], "correctIndex": 0 }

3. FILL IN THE BLANK — "type": "fill_in"
   - PREFER for: math calculations, "write as a decimal/fraction/word form", coordinate answers, single-word answers
   - correctAnswer: the expected answer as a string
   - acceptedAnswers: array of equivalent acceptable forms (optional but recommended for math)
   { "type": "fill_in", "question": "What is 3/10 as a decimal?", "hint": "...", "correctAnswer": "0.3", "acceptedAnswers": ["0.3", ".3", "0.30"] }

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
   { "type": "word_bank", "question": "My sister ____ a dancer.", "hint": "...", "wordBank": ["am","is","are"], "correctAnswer": "is" }

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

SELF-CONTAINED QUESTION RULE (mandatory):
- Every question must be answerable WITHOUT the worksheet in hand
- If a question references data shown visually on the worksheet (prices, measurements, tally counts, distances, scores, etc.), you MUST either:
  a) Embed the data directly in the question text: "Cat = 10¢, Dog = 15¢, Car = 20¢, Bike = 8¢. How much do the car and dog cost together?"
  b) OR include a "context" object (see CONTEXT RULES below) so the app shows a visual reference card above the question
- NEVER write a question like "Which is the cheapest?" without providing the prices somewhere

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
- Use fill_in for every calculation question (e.g. "How much does the car and bike cost together?" → fill_in, correctAnswer "28¢")
- Use ordering when the worksheet says "order from least to greatest" or similar
- Use true_false when the worksheet asks to evaluate a statement
- Use multiple_choice only when the worksheet itself provides answer choices
- DO NOT invent generic questions when specific questions are printed on the worksheet
- DO NOT simplify a calculation question into a "which is cheapest?" multiple-choice question
- When a question needs the price/data table, include a "context" grid object so the kid never needs the paper

VARIETY GUIDANCE:
- Mix types naturally. A math worksheet → fill_in for calculations, ordering for sequences, true_false for comparisons. A grammar worksheet → word_bank for sentence completions. Do NOT force everything into multiple_choice.

Return ONLY this JSON and nothing else:
{
  "valid": true,
  "title": "Short descriptive title",
  "passage": "Optional reading passage — omit if not needed.",
  "questions": [
    {
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
    { "question": "Multiple choice — no context needed", "hint": "...", "options": ["A","B","C","D"], "correctIndex": 2 },
    { "type": "ordering", "question": "Order least to greatest: 15¢, 8¢, 20¢, 10¢", "hint": "...", "items": ["15¢","8¢","20¢","10¢"], "correctOrder": [1,3,0,2] },
    { "type": "true_false", "question": "1/2 > 3/4. True or False?", "hint": "...", "correctAnswer": false },
    { "type": "word_bank", "question": "The children ____ at school.", "hint": "...", "wordBank": ["am","is","are"], "correctAnswer": "are" }
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

  // Optional extras
  if (q.geometry)  sanitized.geometry  = q.geometry;
  if (q.image_ref) sanitized.image_ref = true;
  if (q.context)   sanitized.context   = q.context;   // reference card data

  return sanitized;
}

function sanitizeResponse(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.valid === false) {
    return { valid: false, reason: serverSanitize(String(obj.reason ?? '')) };
  }
  const questions = (obj.questions as Array<Record<string, unknown>> ?? []).map(sanitizeQuestion);
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
      visualAidInstruction = ` The LAST ${rawVisuals.length} image(s) are specific diagrams or charts the parent wants questions about — they are NOT text pages. ${perImageInstructions}. For each visual aid question: reference "the image shown" or "the diagram above" in the question text. The remaining ${questionCount - totalVisualQs} questions come from the text pages only.`;
    }

    userContent.push({
      type: 'text',
      text: `${pageText}${visualAidInstruction} Every question must include a "hint" field. WORKSHEET EXTRACTION PRIORITY: if the image shows a worksheet or problem set, base the questions as closely as possible on the ACTUAL questions printed on the worksheet — same numbers, same scenarios, same level of difficulty. Do NOT simplify or restate the questions in a generic way. Use fill_in for calculation questions, ordering for sequence questions, true_false for comparisons, word_bank for grammar fill-ins. Only use visual_mc (with emoji/unicode) when the worksheet genuinely lacks specific numbers or context and a visual aid would help — do NOT default to visual_mc just to add emoji decoration.`,
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
    const safe   = sanitizeResponse(parsed);

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
