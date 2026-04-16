import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const supabaseKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Use AsyncStorage so the session survives app restarts
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Auth helpers ─────────────────────────────────────────────

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Kid Profile helpers ───────────────────────────────────────

export async function getKidProfiles() {
  const { data, error } = await supabase
    .from('kid_profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createKidProfile(name, avatar = '🦁') {
  const { data, error } = await supabase
    .from('kid_profiles')
    .insert({ name, avatar })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteKidProfile(kidId) {
  const { error } = await supabase
    .from('kid_profiles')
    .delete()
    .eq('id', kidId);
  if (error) throw error;
}

// ── Progress helpers ─────────────────────────────────────────

export async function getProgressForKid(kidId) {
  const { data, error } = await supabase
    .from('progress')
    .select('game_key, best_score')
    .eq('kid_id', kidId);
  if (error) throw error;
  // Return as flat object: { numberline: 7, tools: 5, ... }
  return Object.fromEntries((data ?? []).map(r => [r.game_key, r.best_score]));
}

export async function syncProgressToSupabase(kidId, scores) {
  // scores = { numberline: 7, tools: 5, ... }
  const { error } = await supabase.rpc('upsert_progress', {
    p_kid_id: kidId,
    p_scores: scores,
  });
  if (error) throw error;
}

// ── Subscription helpers ─────────────────────────────────────

export async function getSubscriptionStatus() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'free';
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  return data?.status ?? 'free';
}
