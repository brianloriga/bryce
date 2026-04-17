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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a helpful educational assistant.

Carefully examine the image(s) provided. First determine whether they contain educational or textbook content. Educational content includes: printed text from books or worksheets, math problems or equations, science diagrams or charts, vocabulary lists, reading passages, study notes, or any other academic material meant for studying.

If the image does NOT contain educational content — for example it shows a person's face, an animal, food, a landscape, a building exterior, furniture, a selfie, or any non-academic scene — respond ONLY with this JSON and nothing else:
{
  "valid": false,
  "reason": "Brief, friendly explanation (e.g. 'This looks like a photo of a person rather than a textbook or worksheet page. Please take a photo of an actual book or study material.')"
}

If the image DOES contain educational content, generate 9 multiple-choice practice questions appropriate for the grade level shown in the material.

Rules for questions:
- Each question must have exactly 4 answer options (A, B, C, D)
- Only one option is correct
- Questions should test understanding, not just memory
- Keep questions clear and concise
- If multiple pages are provided, spread the questions across all the content

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Accept `images` array (new) or legacy `imageBase64` string
    const imageList: string[] = body.images
      ? (Array.isArray(body.images) ? body.images : [body.images])
      : body.imageBase64
        ? [body.imageBase64]
        : [];

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
        ? `These are ${imageList.length} pages from the same unit. Generate 9 practice questions covering the content across all pages.`
        : 'Generate 9 practice questions from this page.',
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

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
