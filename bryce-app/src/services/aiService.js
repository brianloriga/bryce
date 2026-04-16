import { supabase } from './supabase';

// Calls the Supabase Edge Function which securely calls GPT-4o Vision.
// The OpenAI API key never touches the client.
export async function generateQuestionsFromImage(base64Image) {
  const { data, error } = await supabase.functions.invoke('generate-questions', {
    body: { imageBase64: base64Image },
  });

  if (error) throw new Error(error.message ?? 'Failed to generate questions');
  if (data?.error) throw new Error(data.error);

  // Validate shape
  if (!data?.questions || !Array.isArray(data.questions)) {
    throw new Error('AI returned an unexpected format. Please try again.');
  }

  // Ensure each question has all required fields
  const questions = data.questions.map((q, i) => ({
    question:     q.question     ?? `Question ${i + 1}`,
    options:      Array.isArray(q.options) && q.options.length === 4
                    ? q.options
                    : ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
  }));

  return {
    title:     data.title ?? 'New Unit',
    questions: questions.slice(0, 9), // cap at 9
  };
}
