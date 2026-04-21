import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getQuizResultsForKid, getKidProfiles } from '../services/supabase';
import KidAvatar from '../components/KidAvatar';

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  2) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pct(score, total) {
  if (!total) return 0;
  return Math.round((score / total) * 100);
}

function starString(stars) {
  return ['☆☆☆', '★☆☆', '★★☆', '★★★'][Math.min(stars ?? 0, 3)];
}

function scoreColor(p) {
  if (p >= 85) return '#4ade80';
  if (p >= 60) return '#fbbf24';
  return '#f87171';
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, t }) {
  return (
    <View style={[statCard(t).card, { borderTopColor: color ?? t.accent }]}>
      <Ionicons name={icon} size={22} color={color ?? t.accent} style={{ marginBottom: 2 }} />
      <Text style={[statCard(t).value, { color: t.text }]}>{value}</Text>
      <Text style={statCard(t).label}>{label}</Text>
      {sub ? <Text style={statCard(t).sub}>{sub}</Text> : null}
    </View>
  );
}

function statCard(t) {
  return {
    card:  { flex: 1, backgroundColor: t.bgCard, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderTopWidth: 3 },
    value: { fontSize: 26, fontWeight: '900' },
    label: { fontSize: 11, fontWeight: '700', color: t.textMuted ?? t.textSub, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
    sub:   { fontSize: 12, color: t.textSub, marginTop: 2 },
  };
}

function ActivityRow({ result, t }) {
  const p     = pct(result.score, result.total);
  const color = scoreColor(p);
  return (
    <View style={[actRow(t).row]}>
      <View style={[actRow(t).dot, { backgroundColor: color + '22', borderColor: color }]}>
        <Text style={[actRow(t).dotText, { color }]}>{p}%</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[actRow(t).title]} numberOfLines={1}>{result.unit_title ?? 'Untitled'}</Text>
        <Text style={actRow(t).detail}>
          {result.score}/{result.total} correct · {starString(result.stars)}
        </Text>
      </View>
      <Text style={actRow(t).time}>{timeAgo(result.played_at)}</Text>
    </View>
  );
}

function actRow(t) {
  return {
    row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
    dot:      { width: 52, height: 52, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    dotText:  { fontSize: 14, fontWeight: '800' },
    title:    { fontSize: 14, fontWeight: '700', color: t.text, marginBottom: 2 },
    detail:   { fontSize: 12, color: t.textSub },
    time:     { fontSize: 11, color: t.textSub, flexShrink: 0 },
  };
}

function LessonRow({ title, attempts, bestScore, bestTotal, bestStars, t }) {
  const p     = pct(bestScore, bestTotal);
  const color = scoreColor(p);
  return (
    <View style={[lessonRow(t).row]}>
      <View style={lessonRow(t).header}>
        <Text style={lessonRow(t).title} numberOfLines={1}>{title}</Text>
        <Text style={[lessonRow(t).pct, { color }]}>{p}%</Text>
      </View>
      <View style={lessonRow(t).track}>
        <View style={[lessonRow(t).fill, { width: `${p}%`, backgroundColor: color }]} />
      </View>
      <Text style={lessonRow(t).meta}>
        {attempts} {attempts === 1 ? 'attempt' : 'attempts'} · best {bestScore}/{bestTotal} · {starString(bestStars)}
      </Text>
    </View>
  );
}

function lessonRow(t) {
  return {
    row:    { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    title:  { fontSize: 14, fontWeight: '700', color: t.text, flex: 1, marginRight: 8 },
    pct:    { fontSize: 14, fontWeight: '800' },
    track:  { height: 6, backgroundColor: t.border, borderRadius: 3, marginBottom: 5, overflow: 'hidden' },
    fill:   { height: 6, borderRadius: 3 },
    meta:   { fontSize: 11, color: t.textSub },
  };
}

// ── Main Screen ───────────────────────────────────────────────

export default function ProgressScreen() {
  const navigation                    = useNavigation();
  const { activeKid, kidProfiles } = useAuth();
  const { theme, isDark }             = useTheme();
  const styles                        = useMemo(() => createStyles(theme), [theme]);

  const [kids, setKids]               = useState([]);
  const [selectedKid, setSelectedKid] = useState(null);
  const [results, setResults]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState(null);

  // Load kid profiles
  useEffect(() => {
    if (kidProfiles?.length) {
      setKids(kidProfiles);
      setSelectedKid(prev => prev ?? (activeKid ?? kidProfiles[0]));
    } else {
      getKidProfiles()
        .then(data => {
          setKids(data);
          setSelectedKid(prev => prev ?? (activeKid ?? data[0] ?? null));
        })
        .catch(() => {});
    }
  }, [kidProfiles, activeKid]);

  const loadResults = useCallback(async (kidId) => {
    if (!kidId) return;
    setError(null);
    try {
      const data = await getQuizResultsForKid(kidId);
      setResults(data);
    } catch {
      setError('Could not load results. Pull down to retry.');
      setResults([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedKid?.id) {
      setLoading(true);
      loadResults(selectedKid.id);
    }
  }, [selectedKid]);

  function onRefresh() {
    setRefreshing(true);
    loadResults(selectedKid?.id);
  }

  // ── Derived stats ───────────────────────────────────────────
  const totalQuizzes   = results.length;
  const totalStars     = results.reduce((s, r) => s + (r.stars ?? 0), 0);
  const avgPct         = totalQuizzes
    ? Math.round(results.reduce((s, r) => s + pct(r.score, r.total), 0) / totalQuizzes)
    : 0;
  const threeStarCount = results.filter(r => r.stars === 3).length;
  const recent         = results.slice(0, 10);

  // Per-lesson best scores
  const lessonMap = {};
  for (const r of results) {
    const key = r.unit_title ?? 'Untitled';
    if (!lessonMap[key]) {
      lessonMap[key] = { title: key, attempts: 0, bestScore: 0, bestTotal: r.total, bestStars: 0 };
    }
    lessonMap[key].attempts++;
    if (pct(r.score, r.total) > pct(lessonMap[key].bestScore, lessonMap[key].bestTotal)) {
      lessonMap[key].bestScore = r.score;
      lessonMap[key].bestTotal = r.total;
      lessonMap[key].bestStars = r.stars ?? 0;
    }
  }
  const lessonList = Object.values(lessonMap).sort(
    (a, b) => pct(b.bestScore, b.bestTotal) - pct(a.bestScore, a.bestTotal)
  );

  // ── Render ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={theme.statusBar} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.textSub} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Multi-kid selector strip */}
      {kids.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kidStrip}
          style={styles.kidStripScroll}
        >
          {kids.map(kid => {
            const active = selectedKid?.id === kid.id;
            return (
              <TouchableOpacity
                key={kid.id}
                style={[styles.kidChip, active && styles.kidChipActive]}
                onPress={() => setSelectedKid(kid)}
                activeOpacity={0.8}
              >
                <KidAvatar name={kid.name} color={kid.avatar} size={32} />
                <Text style={[styles.kidChipName, active && styles.kidChipNameActive]}>
                  {kid.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Single-kid name header */}
      {kids.length === 1 && selectedKid && (
        <View style={styles.singleKidRow}>
          <KidAvatar name={selectedKid.name} color={selectedKid.avatar} size={40} />
          <Text style={styles.singleKidName}>{selectedKid.name}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.loadingText}>Loading results…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : totalQuizzes === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="bar-chart-outline" size={40} color={theme.accent} />
            </View>
            <Text style={styles.emptyTitle}>No quiz history yet</Text>
            <Text style={styles.emptySub}>
              {selectedKid?.name ?? 'This child'} hasn't completed any quizzes yet.{'\n'}
              Head to the Learn tab and start one!
            </Text>
          </View>
        ) : (
          <>
            {/* Stat cards */}
            <View style={styles.statsRow}>
              <StatCard icon="checkmark-circle-outline" label="Quizzes"   value={totalQuizzes}   color={theme.accent}  t={theme} />
              <StatCard icon="trending-up-outline"      label="Avg Score" value={`${avgPct}%`}   color={scoreColor(avgPct)} t={theme} />
              <StatCard icon="star-outline"             label="Stars"     value={totalStars}     sub={`${threeStarCount} perfect`} color="#fbbf24" t={theme} />
            </View>

            {/* Recent activity */}
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.card}>
              {recent.map((r, i) => (
                <ActivityRow key={r.id ?? i} result={r} t={theme} />
              ))}
            </View>

            {/* By lesson */}
            <Text style={styles.sectionTitle}>By Lesson</Text>
            <View style={styles.card}>
              {lessonList.map((l, i) => (
                <LessonRow key={i} {...l} t={theme} />
              ))}
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Theme-aware styles ────────────────────────────────────────

function createStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    backBtn:     { width: 40, alignItems: 'flex-start' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: t.text, textAlign: 'center' },

    // Kid selector
    kidStripScroll: { flexGrow: 0 },
    kidStrip: {
      paddingHorizontal: 16, paddingVertical: 12,
      gap: 10, alignItems: 'center',
    },
    kidChip: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 24, alignSelf: 'flex-start',
      backgroundColor: t.bgCard, borderWidth: 1.5, borderColor: t.border,
    },
    kidChipActive:     { borderColor: t.accent, backgroundColor: t.accentDim },
    kidChipName:       { fontSize: 14, fontWeight: '600', color: t.textSub },
    kidChipNameActive: { color: t.accent },

    // Single kid row
    singleKidRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
    singleKidName: { fontSize: 20, fontWeight: '800', color: t.text },

    // Content
    content: { padding: 20, paddingTop: 12 },

    // Stat cards row
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },

    // Section headings
    sectionTitle: {
      fontSize: 12, fontWeight: '800', color: t.textSub,
      textTransform: 'uppercase', letterSpacing: 0.8,
      marginBottom: 10, marginTop: 4,
    },

    // Card container for rows
    card: {
      backgroundColor: t.bgCard, borderRadius: 18,
      paddingHorizontal: 16, paddingVertical: 4,
      marginBottom: 24,
      borderWidth: 1, borderColor: t.border,
    },

    // States
    centered:    { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
    loadingText: { fontSize: 14, color: t.textSub },
    errorCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14,
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
      padding: 16, marginTop: 40,
    },
    errorText:  { flex: 1, fontSize: 14, color: '#f87171', lineHeight: 20 },
    emptyState:      { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32, gap: 12 },
    emptyIconCircle: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: t.accentDim, borderWidth: 1, borderColor: t.accent + '40',
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: t.text },
    emptySub:   { fontSize: 14, color: t.textSub, textAlign: 'center', lineHeight: 22 },
  });
}
