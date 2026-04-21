import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width: SCREEN_W } = Dimensions.get('window');
const COLS     = 3;
const CARD_GAP = 8;
const CARD_W   = (SCREEN_W - 32 - CARD_GAP * (COLS - 1)) / COLS;
const CARD_H   = CARD_W * 1.45;

const PAIR_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981',
  '#f59e0b', '#ec4899', '#06b6d4',
];

// ── Build card pairs from MC questions ────────────────────────
function buildCards(questions) {
  const eligible = questions.filter(
    q => Array.isArray(q.options) && q.options.length >= 2,
  );
  const pairs = eligible.slice(0, 6);
  const cards = [];
  pairs.forEach((q, idx) => {
    const pairId   = idx;
    const color    = PAIR_COLORS[idx % PAIR_COLORS.length];
    const safeIdx  = Math.min(Math.max(q.correctIndex ?? 0, 0), q.options.length - 1);
    cards.push({ id: `q-${idx}`, pairId, type: 'question', content: q.question ?? '', color });
    cards.push({ id: `a-${idx}`, pairId, type: 'answer',   content: q.options[safeIdx],  color });
  });
  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function getStars(wrongFlips) {
  if (wrongFlips <= 2) return 3;
  if (wrongFlips <= 5) return 2;
  if (wrongFlips <= 10) return 1;
  return 0;
}

// ── Flip card component ───────────────────────────────────────
function FlipCard({ card, onPress, disabled }) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim= useRef(new Animated.Value(0)).current;
  const prevFlipped = useRef(false);

  useEffect(() => {
    const shouldBeFlipped = card.isFlipped || card.isMatched;
    if (shouldBeFlipped !== prevFlipped.current) {
      prevFlipped.current = shouldBeFlipped;
      Animated.spring(flipAnim, {
        toValue: shouldBeFlipped ? 1 : 0,
        useNativeDriver: false,
        tension: 60,
        friction: 8,
      }).start();
    }
  }, [card.isFlipped, card.isMatched]);

  useEffect(() => {
    if (card.isMismatch) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 5,  duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4,  duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [card.isMismatch]);

  const backRotate  = flipAnim.interpolate({ inputRange: [0,1], outputRange: ['0deg',  '180deg'] });
  const frontRotate = flipAnim.interpolate({ inputRange: [0,1], outputRange: ['180deg','360deg'] });

  const isQ = card.type === 'question';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || card.isFlipped || card.isMatched}
      activeOpacity={0.85}
      style={styles.cardTouchable}
    >
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        {/* ── Card back ── */}
        <Animated.View style={[
          styles.card,
          { transform: [{ perspective: 1000 }, { rotateY: backRotate }], backfaceVisibility: 'hidden' },
        ]}>
          <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.cardGradient}>
            <Text style={styles.cardBackSymbol}>✦</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Card front ── */}
        <Animated.View style={[
          styles.card, styles.cardFrontAbs,
          card.isMatched && styles.cardMatched,
          { transform: [{ perspective: 1000 }, { rotateY: frontRotate }], backfaceVisibility: 'hidden' },
        ]}>
          <LinearGradient
            colors={card.isMatched
              ? ['#14532d', '#166534']
              : isQ
                ? [card.color + 'cc', card.color + '88']
                : ['#1e293b', '#0f172a']
            }
            style={styles.cardGradient}
          >
            {/* Colored accent bar at top for question cards */}
            {!card.isMatched && (
              <View style={[styles.cardAccentBar, { backgroundColor: card.color }]} />
            )}
            {card.isMatched && (
              <Text style={styles.matchedCheck}>✓</Text>
            )}
            <Text style={[
              styles.cardText,
              isQ ? styles.cardTextQuestion : styles.cardTextAnswer,
              card.isMatched && styles.cardTextMatched,
            ]} numberOfLines={4}>
              {card.content}
            </Text>
            {!isQ && !card.isMatched && (
              <View style={[styles.answerTag, { backgroundColor: card.color + '44' }]}>
                <Text style={[styles.answerTagText, { color: card.color }]}>Answer</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Main MemoryFlipScreen ─────────────────────────────────────
export default function MemoryFlipScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { unit }   = route.params;

  const eligible = (unit.questions ?? []).filter(
    q => Array.isArray(q.options) && q.options.length >= 2,
  );

  const [gameKey,  setGameKey]  = useState(0);
  const [cards,    setCards]    = useState(() => buildCards(eligible));
  const [flipped,  setFlipped]  = useState([]); // indices of currently face-up unmatched cards
  const [matched,  setMatched]  = useState(0);
  const [wrong,    setWrong]    = useState(0);
  const [seconds,  setSeconds]  = useState(0);
  const [finished, setFinished] = useState(false);
  const timerRef    = useRef(null);
  const lockRef     = useRef(false); // prevents tapping during mismatch delay

  const totalPairs = cards.length / 2;

  // Timer
  useEffect(() => {
    if (finished) return;
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [gameKey, finished]);

  // Check win
  useEffect(() => {
    if (matched > 0 && matched === totalPairs) {
      clearInterval(timerRef.current);
      setTimeout(() => setFinished(true), 600);
    }
  }, [matched, totalPairs]);

  const handleCardPress = useCallback((idx) => {
    if (lockRef.current) return;

    setFlipped(prev => {
      if (prev.length === 0) {
        // First card flip
        setCards(c => c.map((card, i) => i === idx ? { ...card, isFlipped: true, isMismatch: false } : card));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return [idx];
      }

      if (prev.length === 1) {
        const first = prev[0];
        if (first === idx) return prev; // same card

        // Second card flip
        setCards(c => c.map((card, i) => i === idx ? { ...card, isFlipped: true, isMismatch: false } : card));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const firstCard  = cards[first];
        const secondCard = cards[idx];

        if (firstCard.pairId === secondCard.pairId) {
          // MATCH
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            setCards(c => c.map((card, i) =>
              (i === first || i === idx) ? { ...card, isMatched: true, isFlipped: true } : card,
            ));
            setMatched(m => m + 1);
          }, 300);
        } else {
          // MISMATCH
          setWrong(w => w + 1);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          lockRef.current = true;
          setTimeout(() => {
            setCards(c => c.map((card, i) =>
              (i === first || i === idx)
                ? { ...card, isFlipped: false, isMismatch: true }
                : card,
            ));
            // Clear mismatch flag after shake
            setTimeout(() => {
              setCards(c => c.map(card => ({ ...card, isMismatch: false })));
            }, 400);
            lockRef.current = false;
          }, 1000);
        }
        return [];
      }
      return prev;
    });
  }, [cards]);

  function handleReplay() {
    clearInterval(timerRef.current);
    setCards(buildCards(eligible));
    setFlipped([]);
    setMatched(0);
    setWrong(0);
    setSeconds(0);
    setFinished(false);
    lockRef.current = false;
    setGameKey(k => k + 1);
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const stars = getStars(wrong);

  // ── No eligible questions ──────────────────────────────────────
  if (eligible.length < 2) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0a0a1a', '#0f172a']} style={StyleSheet.absoluteFill} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🃏</Text>
          <Text style={styles.emptyTitle}>Need more questions</Text>
          <Text style={styles.emptyDesc}>Memory Flip needs at least 2 multiple-choice questions to build card pairs.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Results ────────────────────────────────────────────────────
  if (finished) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0a0a1a', '#0d1f3c', '#0f172a']} style={StyleSheet.absoluteFill} />
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTrophy}>
            {stars === 3 ? '🏆' : stars === 2 ? '⭐' : stars === 1 ? '🎖️' : '🎮'}
          </Text>
          <Text style={styles.resultsTitle}>Memory Flip Complete!</Text>
          <Text style={styles.resultsStars}>
            {[1,2,3].map(n => n <= stars ? '⭐' : '☆').join('  ')}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalPairs}</Text>
              <Text style={styles.statLabel}>pairs found</Text>
            </View>
            <View style={[styles.statCard, wrong === 0 && styles.statCardGreen]}>
              <Text style={[styles.statValue, wrong === 0 && { color: '#4ade80' }]}>{wrong}</Text>
              <Text style={styles.statLabel}>wrong flips</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#60a5fa' }]}>{formatTime(seconds)}</Text>
              <Text style={styles.statLabel}>time</Text>
            </View>
          </View>

          {wrong === 0 && (
            <View style={styles.perfectCard}>
              <Text style={styles.perfectText}>🌟 Perfect match! No wrong flips!</Text>
            </View>
          )}

          <TouchableOpacity style={styles.replayBtn} onPress={handleReplay}>
            <Text style={styles.replayBtnText}>🃏  Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to Lesson</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Game ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0a0a1a', '#0d1427', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerStat}>
          <Text style={styles.headerStatValue}>{matched}/{totalPairs}</Text>
          <Text style={styles.headerStatLabel}>pairs</Text>
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Memory Flip</Text>
          <Text style={styles.headerSubtitle}>{unit.title}</Text>
        </View>

        <View style={styles.headerStat}>
          <Text style={[styles.headerStatValue, wrong > 5 && { color: '#f87171' }]}>
            {wrong}
          </Text>
          <Text style={styles.headerStatLabel}>wrong</Text>
        </View>
      </View>

      {/* Timer bar */}
      <View style={styles.timerRow}>
        <Text style={styles.timerText}>⏱  {formatTime(seconds)}</Text>
      </View>

      {/* Card grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {Array.from({ length: Math.ceil(cards.length / COLS) }).map((_, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            {cards.slice(rowIdx * COLS, rowIdx * COLS + COLS).map((card, colIdx) => {
              const idx = rowIdx * COLS + colIdx;
              return (
                <FlipCard
                  key={card.id}
                  card={card}
                  onPress={() => handleCardPress(idx)}
                  disabled={lockRef.current}
                />
              );
            })}
          </View>
        ))}

        <TouchableOpacity style={styles.quitBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.quitBtnText}>End Game</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a1a' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  headerStat:      { width: 56, alignItems: 'center' },
  headerStatValue: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerStatLabel: { fontSize: 10, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerCenter:    { flex: 1, alignItems: 'center' },
  headerTitle:     { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSubtitle:  { fontSize: 11, color: '#475569', marginTop: 1 },

  timerRow: { alignItems: 'center', marginBottom: 12 },
  timerText: { fontSize: 13, fontWeight: '700', color: '#334155', letterSpacing: 0.5 },

  // Grid
  grid:    { paddingHorizontal: 16, paddingBottom: 32 },
  gridRow: { flexDirection: 'row', gap: CARD_GAP, marginBottom: CARD_GAP },

  // Cards
  cardTouchable: { width: CARD_W, height: CARD_H },
  card: {
    width: CARD_W, height: CARD_H,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#1e293b',
  },
  cardFrontAbs: {
    position: 'absolute', top: 0, left: 0,
  },
  cardGradient: {
    flex: 1, padding: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBackSymbol: {
    fontSize: 28, color: '#334155', textAlign: 'center',
  },
  cardAccentBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
  },
  cardText: {
    textAlign: 'center', lineHeight: 18,
  },
  cardTextQuestion: {
    fontSize: 12, fontWeight: '700', color: '#fff',
  },
  cardTextAnswer: {
    fontSize: 13, fontWeight: '800', color: '#e2e8f0',
  },
  cardTextMatched: { color: '#4ade80' },
  cardMatched: { borderColor: '#22c55e' },
  matchedCheck: {
    fontSize: 20, color: '#4ade80', marginBottom: 4, fontWeight: '900',
  },
  answerTag: {
    position: 'absolute', bottom: 6,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  answerTagText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Quit
  quitBtn: { alignSelf: 'center', marginTop: 8, paddingVertical: 8, paddingHorizontal: 20 },
  quitBtnText: { fontSize: 13, fontWeight: '600', color: '#334155' },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji:  { fontSize: 56, marginBottom: 16 },
  emptyTitle:  { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  emptyDesc:   { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyBtn:    { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText:{ fontSize: 15, fontWeight: '700', color: '#94a3b8' },

  // Results
  resultsContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  resultsTrophy: { fontSize: 64, marginBottom: 8 },
  resultsTitle:  { fontSize: 22, fontWeight: '800', color: '#94a3b8', marginBottom: 12 },
  resultsStars:  { fontSize: 28, marginBottom: 24, letterSpacing: 8 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, width: '100%' },
  statCard: {
    flex: 1, backgroundColor: '#111827', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#1e293b',
  },
  statCardGreen: { borderColor: 'rgba(74,222,128,0.3)' },
  statValue:     { fontSize: 26, fontWeight: '900', color: '#fff' },
  statLabel:     { fontSize: 10, fontWeight: '600', color: '#475569', marginTop: 4, textTransform: 'uppercase' },

  perfectCard: {
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', width: '100%', alignItems: 'center',
  },
  perfectText: { fontSize: 15, fontWeight: '700', color: '#fbbf24' },

  replayBtn:     { backgroundColor: '#6d28d9', borderRadius: 16, paddingVertical: 18, alignItems: 'center', width: '100%', marginBottom: 12 },
  replayBtnText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  doneBtn:       { paddingVertical: 14, alignItems: 'center' },
  doneBtnText:   { fontSize: 15, color: '#475569', fontWeight: '600' },
});
