import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getQuizResultsForKid, getKidProfiles } from '../services/supabase';
import KidAvatar from '../components/KidAvatar';
import { resolveSubject } from '../utils/subjects';

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
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
  return ['☆☆☆','★☆☆','★★☆','★★★'][Math.min(stars ?? 0, 3)];
}

function scoreColor(p) {
  if (p >= 85) return '#4ade80';
  if (p >= 60) return '#fbbf24';
  return '#f87171';
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }) {
  return (
    <View style={[statStyles.card, { borderTopColor: color ?? '#60a5fa' }]}>
      <Ionicons name={icon} size={22} color={color ?? '#60a5fa'} style={statStyles.icon} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {sub ? <Text style={statStyles.sub}>{sub}</Text> : null}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 16,
    padding: 14, alignItems: 'center', gap: 4,
    borderTopWidth: 3,
  },
  icon:  { marginBottom: 2 },
  value: { fontSize: 26, fontWeight: '900', color: '#fff' },
  label: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  sub:   { fontSize: 12, color: '#475569', marginTop: 2 },
});

function ActivityRow({ result }) {
  const p = pct(result.score, result.total);
  const color = scoreColor(p);
  const subjectColor = resolveSubject(result.subject, [])?.color ?? '#60a5fa';
  return (
    <View style={actStyles.row}>
      <View style={[actStyles.scoreDot, { backgroundColor: color + '22', borderColor: color }]}>
        <Text style={[actStyles.scoreText, { color }]}>{p}%</Text>
      </View>
      <View style={actStyles.middle}>
        <Text style={actStyles.title} numberOfLines={1}>{result.unit_title ?? 'Untitled'}</Text>
        <Text style={actStyles.detail}>
          {result.score}/{result.total} correct · {starString(result.stars)}
        </Text>
      </View>
      <Text style={actStyles.time}>{timeAgo(result.played_at)}</Text>
    </View>
  );
}

const actStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  scoreDot: {
    width: 52, height: 52, borderRadius: 14, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  scoreText: { fontSize: 14, fontWeight: '800' },
  middle:    { flex: 1 },
  title:     { fontSize: 14, fontWeight: '700', color: '#e2e8f0', marginBottom: 2 },
  detail:    { fontSize: 12, color: '#64748b' },
  time:      { fontSize: 11, color: '#475569', flexShrink: 0 },
});

function LessonRow({ title, attempts, bestScore, bestTotal, bestStars }) {
  const p     = pct(bestScore, bestTotal);
  const color = scoreColor(p);
  const barW  = `${p}%`;
  return (
    <View style={lessonStyles.row}>
      <View style={lessonStyles.header}>
        <Text style={lessonStyles.title} numberOfLines={1}>{title}</Text>
        <Text style={[lessonStyles.pct, { color }]}>{p}%</Text>
      </View>
      <View style={lessonStyles.track}>
        <View style={[lessonStyles.fill, { width: barW, backgroundColor: color }]} />
      </View>
      <Text style={lessonStyles.meta}>
        {attempts} {attempts === 1 ? 'attempt' : 'attempts'} · best {bestScore}/{bestTotal} · {starString(bestStars)}
      </Text>
    </View>
  );
}

const lessonStyles = StyleSheet.create({
  row:    { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  title:  { fontSize: 14, fontWeight: '700', color: '#e2e8f0', flex: 1, marginRight: 8 },
  pct:    { fontSize: 14, fontWeight: '800' },
  track:  { height: 6, backgroundColor: '#1e293b', borderRadius: 3, marginBottom: 5, overflow: 'hidden' },
  fill:   { height: 6, borderRadius: 3 },
  meta:   { fontSize: 11, color: '#475569' },
});

// ── Main Screen ───────────────────────────────────────────────

export default function ProgressScreen() {
  const navigation          = useNavigation();
  const { activeKid, kids: authKids } = useAuth();

  const [kids, setKids]             = useState([]);
  const [selectedKid, setSelectedKid] = useState(null);
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);

  // Load kid profiles (use authKids if available, otherwise fetch)
  useEffect(() => {
    if (authKids?.length) {
      setKids(authKids);
      setSelectedKid(prev => prev ?? (activeKid ?? authKids[0]));
    } else {
      getKidProfiles()
        .then(data => {
          setKids(data);
          setSelectedKid(prev => prev ?? (activeKid ?? data[0] ?? null));
        })
        .catch(() => {});
    }
  }, [authKids, activeKid]);

  const loadResults = useCallback(async (kidId) => {
    if (!kidId) return;
    setError(null);
    try {
      const data = await getQuizResultsForKid(kidId);
      setResults(data);
    } catch (e) {
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
  const totalQuizzes  = results.length;
  const totalStars    = results.reduce((s, r) => s + (r.stars ?? 0), 0);
  const avgPct        = totalQuizzes
    ? Math.round(results.reduce((s, r) => s + pct(r.score, r.total), 0) / totalQuizzes)
    : 0;
  const threeStarCount = results.filter(r => r.stars === 3).length;

  // Recent 10 results for activity feed
  const recent = results.slice(0, 10);

  // Per-lesson best scores
  const lessonMap = {};
  for (const r of results) {
    const key = r.unit_title ?? 'Untitled';
    if (!lessonMap[key]) {
      lessonMap[key] = { title: key, attempts: 0, bestScore: 0, bestTotal: r.total, bestStars: 0 };
    }
    lessonMap[key].attempts++;
    const p = pct(r.score, r.total);
    if (p > pct(lessonMap[key].bestScore, lessonMap[key].bestTotal)) {
      lessonMap[key].bestScore = r.score;
      lessonMap[key].bestTotal = r.total;
      lessonMap[key].bestStars = r.stars ?? 0;
    }
  }
  const lessonList = Object.values(lessonMap).sort((a, b) =>
    pct(b.bestScore, b.bestTotal) - pct(a.bestScore, a.bestTotal)
  );

  // ── Render ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Kid selector */}
      {kids.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kidStrip}
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
                <KidAvatar kid={kid} size={32} />
                <Text style={[styles.kidChipName, active && styles.kidChipNameActive]}>
                  {kid.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Single kid name header when only one kid */}
      {kids.length === 1 && selectedKid && (
        <View style={styles.singleKidRow}>
          <KidAvatar kid={selectedKid} size={40} />
          <Text style={styles.singleKidName}>{selectedKid.name}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#60a5fa"
          />
        }
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.loadingText}>Loading results…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : totalQuizzes === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>No quiz history yet</Text>
            <Text style={styles.emptySub}>
              {selectedKid?.name ?? 'This child'} hasn't completed any quizzes yet.
              {'\n'}Head to the Learn tab and start one!
            </Text>
          </View>
        ) : (
          <>
            {/* Stat cards row */}
            <View style={styles.statsRow}>
              <StatCard
                icon="checkmark-circle-outline"
                label="Quizzes"
                value={totalQuizzes}
                color="#60a5fa"
              />
              <StatCard
                icon="trending-up-outline"
                label="Avg Score"
                value={`${avgPct}%`}
                color={scoreColor(avgPct)}
              />
              <StatCard
                icon="star-outline"
                label="Stars"
                value={totalStars}
                sub={`${threeStarCount} perfect`}
                color="#fbbf24"
              />
            </View>

            {/* Recent activity */}
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.card}>
              {recent.length === 0 ? (
                <Text style={styles.emptySection}>No recent activity</Text>
              ) : (
                recent.map((r, i) => (
                  <ActivityRow key={r.id ?? i} result={r} />
                ))
              )}
            </View>

            {/* By lesson */}
            <Text style={styles.sectionTitle}>By Lesson</Text>
            <View style={styles.card}>
              {lessonList.length === 0 ? (
                <Text style={styles.emptySection}>No lesson data</Text>
              ) : (
                lessonList.map((l, i) => (
                  <LessonRow key={i} {...l} />
                ))
              )}
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#0f172a' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },

  // Kid selector strip
  kidStrip: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  kidChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1e293b', borderWidth: 1.5, borderColor: '#334155',
  },
  kidChipActive:     { borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.12)' },
  kidChipName:       { fontSize: 14, fontWeight: '600', color: '#64748b' },
  kidChipNameActive: { color: '#60a5fa' },

  // Single kid row
  singleKidRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  singleKidName: { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Content
  content: { padding: 20, paddingTop: 10 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },

  // Sections
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10, marginTop: 4,
  },
  card: {
    backgroundColor: '#1e293b', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 4,
    marginBottom: 24,
  },

  // States
  centered:    { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  loadingText: { fontSize: 14, color: '#475569' },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    padding: 16, marginTop: 40,
  },
  errorText:    { flex: 1, fontSize: 14, color: '#f87171', lineHeight: 20 },
  emptyState:   { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyEmoji:   { fontSize: 52, marginBottom: 8 },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: '#fff' },
  emptySub:     { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22 },
  emptySection: { fontSize: 13, color: '#475569', paddingVertical: 16, textAlign: 'center' },
});
