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

If the image DOES contain educational content, generate 9 multiple-choice practice questions appropriate for the grade level shown in the material.

Rules for questions:
- Each question must have exactly 4 answer options (A, B, C, D)
- Only one option is correct
- Questions should test understanding, not just memory
- Keep questions clear, concise, and child-friendly
- If multiple pages are provided, spread the questions across all the content
- Never ask questions about inappropriate topics regardless of what appears in the image

Return ONLY this JSON and nothing else:
{
  "valid": true,
  "title": "Short descriptive title (e.g. 'Chapter 5 — Adding Fractions')",
  "questions": [
    {
      "question": "The question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0
    }
  ]
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

function sanitizeResponse(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.valid === false) {
    return { valid: false, reason: serverSanitize(String(obj.reason ?? '')) };
  }
  const questions = (obj.questions as Array<Record<string, unknown>> ?? []).map(q => ({
    question:     serverSanitize(String(q.question ?? '')),
    options:      (q.options as string[] ?? []).map(serverSanitize),
    correctIndex: q.correctIndex,
  }));
  return { valid: true, title: serverSanitize(String(obj.title ?? '')), questions };
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
    // ── Rate limiting ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    const userId = parseJwtUserId(jwt);

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
    // ── End rate limiting ──────────────────────────────────────

    const body = await req.json();

    // Accept `images` array (new) or legacy `imageBase64` string
    const imageList: string[] = body.images
      ? (Array.isArray(body.images) ? body.images : [body.images])
      : body.imageBase64
        ? [body.imageBase64]
        : [];

    const questionCount: number = Math.min(Math.max(Number(body.questionCount) || 9, 5), 20);

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

    // Build user message: all images + a final text prompt
    const userContent: unknown[] = imageList.map((b64) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
    }));

    userContent.push({
      type: 'text',
      text: imageList.length > 1
        ? `These are ${imageList.length} pages from the same unit. Generate exactly ${questionCount} practice questions spread evenly across all pages.`
        : `Generate exactly ${questionCount} practice questions from this page.`,
    });

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
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

    return new Response(
      JSON.stringify(safe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
