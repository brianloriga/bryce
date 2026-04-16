// Supabase Edge Function — generate-questions
// Receives a base64 image, sends to GPT-4o Vision, returns structured questions.
//
// Deploy with:
//   npx supabase functions deploy generate-questions
//
// Set secret:
//   npx supabase secrets set OPENAI_API_KEY=sk-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a helpful 4th grade teacher assistant.
The user will send you an image of a textbook page.
Your job is to generate 9 multiple-choice practice questions that a student can answer after studying this page.

Rules:
- Questions should be appropriate for the grade level shown in the content
- Each question must have exactly 4 answer options (A, B, C, D)
- Only one option is correct
- Questions should test understanding, not just memory
- Keep questions clear and concise

Return ONLY valid JSON in this exact format, no other text:
{
  "title": "Short descriptive title for this unit (e.g. 'Fractions - Adding and Subtracting')",
  "questions": [
    {
      "question": "The question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0
    }
  ]
}`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
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
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: 'Generate 9 practice questions from this textbook page.',
              },
            ],
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const err = await openaiResponse.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    // Parse the JSON response from GPT
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
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
