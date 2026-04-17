import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { getKidProfiles, getProgressForKid } from '../services/supabase';
import { saveActiveKid, getActiveKid, buildLocalStoragePayload } from '../services/progressSync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(null);   // Supabase session
  const [user, setUser]               = useState(null);   // Supabase user
  const [kidProfiles, setKidProfiles] = useState([]);     // This parent's kids
  const [activeKid, setActiveKidState] = useState(null);  // Currently playing kid
  const [cloudScores, setCloudScores] = useState(null);   // Flat scores from Supabase
  const [loading, setLoading]         = useState(true);
  const [kidLoadError, setKidLoadError] = useState(null);

  // ── Listen for auth state changes ──────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Load kid profiles when user logs in ────────────────────
  useEffect(() => {
    if (!user) {
      setKidProfiles([]);
      setActiveKidState(null);
      setCloudScores(null);
      setLoading(false);
      return;
    }
    loadKidProfiles();
  }, [user]);

  async function loadKidProfiles() {
    setLoading(true);
    setKidLoadError(null);
    try {
      const profiles = await getKidProfiles();
      setKidProfiles(profiles);

      const savedKidId = await getActiveKid();
      const match = profiles.find(p => p.id === savedKidId);
      if (match) {
        await selectKid(match, false);
      }
    } catch (err) {
      setKidLoadError(err.message ?? 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }

  // ── Select which kid is playing ────────────────────────────
  async function selectKid(kid, persist = true) {
    setActiveKidState(kid);
    if (persist) await saveActiveKid(kid.id);

    try {
      const scores = await getProgressForKid(kid.id);
      setCloudScores(scores);
    } catch {
      setCloudScores({});
    }
  }

  // The localStorage JSON string to inject into the WebView on startup
  const initialLocalStoragePayload = cloudScores
    ? buildLocalStoragePayload(cloudScores)
    : null;

  const value = {
    session,
    user,
    kidProfiles,
    activeKid,
    cloudScores,
    loading,
    kidLoadError,
    selectKid,
    reloadKids: loadKidProfiles,
    initialLocalStoragePayload,
    isLoggedIn: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
