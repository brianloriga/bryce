import React, { useState, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';

const TOTAL_TIME   = 60;
const OPTION_COLORS  = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
const OPTION_LABELS  = ['A', 'B', 'C', 'D'];

function multiplierFor(streak) {
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  return 1;
}

function streakLabel(streak) {
  if (streak >= 6) return `🔥🔥🔥 ×${streak}`;
  if (streak >= 3) return `🔥🔥 ×${streak}`;
  if (streak >= 1) return `🔥 ×${streak}`;
  return null;
}

// ── GameEngine ─────────────────────────────────────────────────
// Extracted so replay can simply increment a key and remount it.
function GameEngine({ questions, onFinish }) {
  const [timeLeft, setTimeLeft]   = useState(TOTAL_TIME);
  const [qIdx, setQIdx]           = useState(0);
  const [score, setScore]         = useState(0);
  const [streak, setStreak]       = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect]   = useState(0);
  const [selectedIdx, setSelectedIdx]     = useState(null);
  const [feedback, setFeedback]           = useState(null); // null | 'correct' | 'wrong'

  // Animations
  const popupY       = useRef(new Animated.Value(0)).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const timerScale   = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [popupText,   setPopupText]   = useState('+10');
  const [flashColor,  setFlashColor]  = useState('transparent');

  const timerRef    = useRef(null);
  const feedbackRef = useRef(null);
  const doneRef     = useRef(false);

  const q           = questions[qIdx];
  const safeCorrect = q ? Math.min(Math.max(q.correctIndex ?? 0, 0), (q.options?.length ?? 1) - 1) : 0;
  const timerColor  = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#4ade80';

  // Global countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!doneRef.current) {
            doneRef.current = true;
            setTimeout(() => setTimeLeft(0), 50);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      clearInterval(timerRef.current);
      if (feedbackRef.current) clearTimeout(feedbackRef.current);
    };
  }, []);

  // Clear interval when timer hits 0
  useEffect(() => {
    if (timeLeft === 0) {
      clearInterval(timerRef.current);
      if (!doneRef.current) doneRef.current = true;
    }
  }, [timeLeft]);

  // Pulse animation when time is low
  useEffect(() => {
    if (timeLeft > 0 && timeLeft <= 10) {
      Animated.sequence([
        Animated.timing(timerScale, { toValue: 1.35, duration: 120, useNativeDriver: true }),
        Animated.timing(timerScale, { toValue: 1,    duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [timeLeft]);

  function showPopup(points) {
    setPopupText(`+${points}`);
    popupY.setValue(0);
    popupOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(popupY,       { toValue: -72, duration: 900, useNativeDriver: true }),
      Animated.timing(popupOpacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
    ]).start();
  }

  function flashScreen(color) {
    setFlashColor(color);
    flashOpacity.setValue(0.35);
    Animated.timing(flashOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
  }

  function advance() {
    if (doneRef.current && timeLeft === 0) return;
    const nextIdx = qIdx + 1;
    if (nextIdx >= questions.length) {
      clearInterval(timerRef.current);
      doneRef.current = true;
      setQIdx(nextIdx);
    } else {
      setQIdx(nextIdx);
      setSelectedIdx(null);
      setFeedback(null);
    }
  }

  function handleAnswer(index) {
    if (feedback || !q || doneRef.current) return;
    setSelectedIdx(index);
    setTotalAnswered(prev => prev + 1);
    const isCorrect = index === safeCorrect;
    if (isCorrect) {
      const newStreak  = streak + 1;
      const multiplier = multiplierFor(newStreak);
      const points     = 10 * multiplier;
      setStreak(newStreak);
      setMaxStreak(prev => Math.max(prev, newStreak));
      setScore(prev => prev + points);
      setTotalCorrect(prev => prev + 1);
      setFeedback('correct');
      showPopup(points);
      flashScreen('#4ade80');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      feedbackRef.current = setTimeout(advance, 450);
    } else {
      setStreak(0);
      setFeedback('wrong');
      flashScreen('#ef4444');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      feedbackRef.current = setTimeout(advance, 1100);
    }
  }

  // Notify parent after render — never during render
  const isDone = timeLeft === 0 || qIdx >= questions.length;
  useEffect(() => {
    if (isDone) {
      onFinish({ score, totalAnswered, totalCorrect, maxStreak });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone]);

  if (isDone) return null;

  const label = streakLabel(streak);

  function renderOption(i) {
    if (!q.options || i >= q.options.length) return <View key={i} style={styles.optionPlaceholder} />;
    const base = OPTION_COLORS[i % OPTION_COLORS.length];
    let bgColor     = base + '22';
    let borderColor = base + '66';
    let textColor   = '#e2e8f0';
    if (feedback) {
      if (i === safeCorrect)      { bgColor = '#14532d'; borderColor = '#22c55e'; textColor = '#4ade80'; }
      else if (i === selectedIdx) { bgColor = '#7f1d1d'; borderColor = '#ef4444'; textColor = '#f87171'; }
      else                        { bgColor = base + '0d'; borderColor = base + '22'; textColor = '#475569'; }
    }
    return (
      <TouchableOpacity
        key={i}
        style={[styles.optionBtn, { backgroundColor: bgColor, borderColor }]}
        onPress={() => handleAnswer(i)}
        disabled={!!feedback}
        activeOpacity={0.72}
      >
        <View style={[styles.optionBadge, { backgroundColor: base }]}>
          <Text style={styles.optionBadgeText}>{OPTION_LABELS[i]}</Text>
        </View>
        <Text style={[styles.optionText, { color: textColor }]} numberOfLines={3}>
          {q.options[i]}
        </Text>
      </TouchableOpacity>
    );
  }

  // Timer bar: percentage remaining 0..1
  const timerPct = timeLeft / TOTAL_TIME;

  // Background gradient shifts warmer as streak builds
  const bgColors = streak >= 6
    ? ['#1a0a00', '#1a0f00', '#0f172a']
    : streak >= 3
      ? ['#0d0a1a', '#120a1f', '#0f172a']
      : ['#080f1f', '#0a1628', '#0f172a'];

  return (
    <View style={styles.gameContainer}>
      {/* Dynamic gradient background */}
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      {/* Full-screen answer flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, opacity: flashOpacity }]}
      />

      {/* Floating score popup */}
      <Animated.Text style={[
        styles.scorePopup,
        { transform: [{ translateY: popupY }], opacity: popupOpacity },
      ]}>
        {popupText}
      </Animated.Text>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreValue}>{score}</Text>
          <Text style={styles.scoreLabel}>pts</Text>
        </View>
        <View style={styles.headerCenter}>
          {label ? (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>{label}</Text>
            </View>
          ) : (
            <Text style={styles.streakPlaceholder}>Speed Round</Text>
          )}
        </View>
        {/* Timer box */}
        <Animated.View style={[styles.timerBox, { transform: [{ scale: timerScale }] }]}>
          <Text style={[styles.timerValue, { color: timerColor }]}>{timeLeft}</Text>
          <Text style={styles.timerSec}>sec</Text>
          {/* Mini drain bar under the number */}
          <View style={styles.timerBarTrack}>
            <View style={[styles.timerBarFill, { width: `${timerPct * 100}%`, backgroundColor: timerColor }]} />
          </View>
        </Animated.View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, (qIdx / questions.length) * 100)}%` }]} />
      </View>

      {/* Question card */}
      <View style={styles.questionCard}>
        <Text style={styles.questionCounter}>Question {qIdx + 1} of {questions.length}</Text>
        <Text style={styles.questionText} numberOfLines={5}>{q.question ?? ''}</Text>
      </View>

      {/* Options 2×2 grid */}
      <View style={styles.optionsGrid}>
        <View style={styles.optionsRow}>{[0, 1].map(i => renderOption(i))}</View>
        <View style={styles.optionsRow}>
          {[2, 3].map(i =>
            i >= (q.options?.length ?? 0)
              ? <View key={i} style={styles.optionPlaceholder} />
              : renderOption(i),
          )}
        </View>
      </View>

      {/* End Game */}
      <TouchableOpacity style={styles.quitBtn} onPress={() => {
        doneRef.current = true;
        clearInterval(timerRef.current);
        onFinish({ score, totalAnswered, totalCorrect, maxStreak });
      }}>
        <Text style={styles.quitBtnText}>End Game</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function SpeedRoundScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { unit }   = route.params;

  const mcQuestions = (unit.questions ?? []).filter(q =>
    Array.isArray(q.options) && q.options.length >= 2,
  );

  const [gameKey, setGameKey] = useState(0);
  const [result, setResult]   = useState(null);
  const shuffledRef           = useRef([]);

  useEffect(() => {
    shuffledRef.current = [...mcQuestions].sort(() => Math.random() - 0.5);
  }, [gameKey]);

  function handleReplay() {
    setResult(null);
    setGameKey(k => k + 1);
  }

  // ── No eligible questions ──────────────────────────────────────
  if (mcQuestions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎮</Text>
          <Text style={styles.emptyTitle}>Speed Round needs multiple-choice questions</Text>
          <Text style={styles.emptyDesc}>
            This lesson only has typed-answer questions. Edit it in the Scan tab to add multiple-choice questions.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Results ────────────────────────────────────────────────────
  if (result) {
    const { score, totalAnswered, totalCorrect, maxStreak } = result;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const trophy   = score >= 200 ? '🏆' : score >= 100 ? '⭐' : '🎮';
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.resultsContainer}>
          <View style={styles.resultsTrophy}>
            <Text style={styles.resultsTrophyEmoji}>{trophy}</Text>
          </View>
          <Text style={styles.resultsTitle}>Speed Round Complete!</Text>
          <View style={styles.resultsBigScoreBox}>
            <Text style={styles.resultsBigScore}>{score}</Text>
            <Text style={styles.resultsBigScoreLabel}>points</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalAnswered}</Text>
              <Text style={styles.statLabel}>answered</Text>
            </View>
            <View style={[styles.statCard, styles.statCardMid]}>
              <Text style={[styles.statValue, { color: '#4ade80' }]}>{totalCorrect}</Text>
              <Text style={styles.statLabel}>correct</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#60a5fa' }]}>{accuracy}%</Text>
              <Text style={styles.statLabel}>accuracy</Text>
            </View>
          </View>
          {maxStreak >= 3 && (
            <View style={styles.comboCard}>
              <Text style={styles.comboText}>🔥 Best combo: {maxStreak} in a row</Text>
              {maxStreak >= 6 && <Text style={styles.comboBonusText}>Triple multiplier achieved!</Text>}
            </View>
          )}
          <TouchableOpacity style={styles.replayBtn} onPress={handleReplay}>
            <Text style={styles.replayBtnText}>⚡  Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to Lesson</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Active game ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <GameEngine
        key={gameKey}
        questions={shuffledRef.current}
        onFinish={setResult}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080f1f' },

  gameContainer: { flex: 1, paddingHorizontal: 16, paddingBottom: 12, overflow: 'hidden' },

  scorePopup: {
    position: 'absolute', alignSelf: 'center', top: 100,
    fontSize: 32, fontWeight: '900', color: '#4ade80', zIndex: 99,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 10 },
  scoreBox: {
    width: 72, alignItems: 'center', backgroundColor: '#1e293b',
    borderRadius: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#334155',
  },
  scoreValue: { fontSize: 22, fontWeight: '900', color: '#fff' },
  scoreLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },

  headerCenter:      { flex: 1, alignItems: 'center' },
  streakBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
  },
  streakText:        { fontSize: 14, fontWeight: '800', color: '#fbbf24' },
  streakPlaceholder: { fontSize: 13, fontWeight: '700', color: '#334155', letterSpacing: 1 },

  timerBox: {
    width: 68, alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 14,
    paddingVertical: 8, paddingHorizontal: 6,
    borderWidth: 1, borderColor: '#334155',
  },
  timerValue:   { fontSize: 24, fontWeight: '900', lineHeight: 28 },
  timerSec:     { fontSize: 9, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  timerBarTrack: {
    width: '100%', height: 3, borderRadius: 2,
    backgroundColor: '#0f172a', marginTop: 5, overflow: 'hidden',
  },
  timerBarFill: { height: '100%', borderRadius: 2 },

  progressTrack: { height: 3, backgroundColor: '#1e293b', borderRadius: 2, marginBottom: 14 },
  progressFill:  { height: 3, backgroundColor: '#3b82f6', borderRadius: 2 },

  questionCard: {
    backgroundColor: '#111827', borderRadius: 20, padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: '#1e293b', minHeight: 110, justifyContent: 'center',
  },
  questionCounter: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  questionText:    { fontSize: 20, fontWeight: '700', color: '#f1f5f9', lineHeight: 28 },

  optionsGrid:       { flex: 1, gap: 10, justifyContent: 'flex-end', marginBottom: 4 },
  optionsRow:        { flexDirection: 'row', gap: 10 },
  optionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, padding: 14, borderWidth: 2, minHeight: 72,
  },
  optionBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optionBadgeText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  optionText:      { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  optionPlaceholder: { flex: 1 },

  quitBtn: { alignSelf: 'center', marginTop: 8, paddingVertical: 8, paddingHorizontal: 20 },
  quitBtnText: { fontSize: 13, fontWeight: '600', color: '#334155' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji:   { fontSize: 56, marginBottom: 16 },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  emptyDesc:    { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyBtn:     { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },

  resultsContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  resultsTrophy:      { marginBottom: 4 },
  resultsTrophyEmoji: { fontSize: 64 },
  resultsTitle: { fontSize: 22, fontWeight: '800', color: '#94a3b8', marginBottom: 20, marginTop: 8 },
  resultsBigScoreBox: { alignItems: 'center', marginBottom: 28 },
  resultsBigScore:      { fontSize: 80, fontWeight: '900', color: '#fff', lineHeight: 88 },
  resultsBigScoreLabel: { fontSize: 16, fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: 1 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, width: '100%' },
  statCard: {
    flex: 1, backgroundColor: '#111827', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#1e293b',
  },
  statCardMid: { borderColor: 'rgba(74,222,128,0.2)' },
  statValue:   { fontSize: 26, fontWeight: '900', color: '#fff' },
  statLabel:   { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 4, textTransform: 'uppercase' },

  comboCard: {
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', width: '100%', alignItems: 'center',
  },
  comboText:      { fontSize: 16, fontWeight: '800', color: '#fbbf24' },
  comboBonusText: { fontSize: 12, color: '#92400e', marginTop: 4, fontWeight: '600' },

  replayBtn: { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 18, alignItems: 'center', width: '100%', marginBottom: 12 },
  replayBtnText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  doneBtn:     { paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { fontSize: 15, color: '#475569', fontWeight: '600' },
});
