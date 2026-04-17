import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Markdown from 'react-native-markdown-display';
import Svg, { Circle, Path, Rect, Line, Polygon, Text as SvgText, G } from 'react-native-svg';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { saveQuizResult } from '../services/supabase';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

function getStars(correct, total) {
  const pct = correct / total;
  if (pct >= 0.89) return 3;
  if (pct >= 0.67) return 2;
  if (pct >= 0.45) return 1;
  return 0;
}

// ── Geometry renderer ────────────────────────────────────────
function GeometryDisplay({ geometry }) {
  if (!geometry?.type) return null;
  const W = 260;

  if (geometry.type === 'pie') {
    const slices = geometry.slices ?? [];
    const cx = W / 2, cy = 100, r = 80;
    let startAngle = -Math.PI / 2;
    const paths = slices.map((s, i) => {
      const angle = (s.fraction ?? 0) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const large = angle > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      startAngle = endAngle;
      return <Path key={i} d={d} fill={s.color ?? '#6366f1'} stroke="#0f172a" strokeWidth="2" />;
    });
    return (
      <View style={geoStyles.container}>
        <Svg width={W} height={210}>
          {paths}
          {slices.map((s, i) => {
            const midAngle = slices.slice(0, i).reduce((a, x) => a + (x.fraction ?? 0), 0) * 2 * Math.PI
              + (s.fraction ?? 0) * Math.PI - Math.PI / 2;
            const lx = cx + (r * 0.65) * Math.cos(midAngle);
            const ly = cy + (r * 0.65) * Math.sin(midAngle);
            return (
              <SvgText key={i} x={lx} y={ly + 5} textAnchor="middle"
                fontSize="13" fontWeight="bold" fill="#fff">
                {s.label ?? ''}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    );
  }

  if (geometry.type === 'bar') {
    const bars = geometry.bars ?? [];
    const maxVal = geometry.maxValue ?? Math.max(...bars.map(b => b.value ?? 0), 1);
    const barW = Math.min(40, (W - 40) / Math.max(bars.length, 1) - 8);
    const chartH = 100;
    return (
      <View style={geoStyles.container}>
        <Svg width={W} height={chartH + 40}>
          {bars.map((b, i) => {
            const bh = Math.max(4, ((b.value ?? 0) / maxVal) * chartH);
            const x = 20 + i * (barW + 8);
            const y = chartH - bh;
            return (
              <G key={i}>
                <Rect x={x} y={y} width={barW} height={bh} fill="#6366f1" rx="4" />
                <SvgText x={x + barW / 2} y={chartH + 16} textAnchor="middle"
                  fontSize="11" fill="#94a3b8">{b.label ?? ''}</SvgText>
                <SvgText x={x + barW / 2} y={y - 4} textAnchor="middle"
                  fontSize="11" fontWeight="bold" fill="#e2e8f0">{b.value}</SvgText>
              </G>
            );
          })}
          <Line x1="16" y1={chartH} x2={W - 16} y2={chartH} stroke="#334155" strokeWidth="1" />
        </Svg>
      </View>
    );
  }

  if (geometry.type === 'shape') {
    const kind = geometry.kind ?? 'rectangle';
    const filled = geometry.shaded !== false;
    const fill = filled ? '#6366f1' : '#1e293b';
    const stroke = '#818cf8';
    return (
      <View style={geoStyles.container}>
        <Svg width={W} height={120}>
          {kind === 'circle' && (
            <Circle cx={W / 2} cy={60} r={50} fill={fill} stroke={stroke} strokeWidth="2.5" />
          )}
          {kind === 'rectangle' && (
            <Rect x={60} y={20} width={140} height={80} fill={fill} stroke={stroke} strokeWidth="2.5" rx="4" />
          )}
          {kind === 'triangle' && (
            <Polygon points={`${W / 2},15 ${W - 50},105 50,105`}
              fill={fill} stroke={stroke} strokeWidth="2.5" />
          )}
          {geometry.label ? (
            <SvgText x={W / 2} y={60} textAnchor="middle" dy="5"
              fontSize="14" fontWeight="bold" fill="#fff">{geometry.label}</SvgText>
          ) : null}
        </Svg>
      </View>
    );
  }

  return null;
}

const geoStyles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 16, marginTop: 4 },
});

// ── Markdown styles for dark theme ──────────────────────────
const mdStyles = {
  body:       { color: '#f1f5f9', fontSize: 20, fontWeight: '700', lineHeight: 30 },
  strong:     { color: '#60a5fa', fontWeight: '800' },
  em:         { color: '#94a3b8', fontStyle: 'italic' },
  code_inline:{ color: '#4ade80', backgroundColor: '#0f2a1a', borderRadius: 4, paddingHorizontal: 4 },
  fence:      { color: '#4ade80', backgroundColor: '#0f2a1a', borderRadius: 8, padding: 12 },
  table:      { borderWidth: 1, borderColor: '#334155', borderRadius: 8, marginBottom: 8 },
  th:         { backgroundColor: '#1e3a5f', padding: 8, color: '#60a5fa', fontWeight: '700' },
  td:         { padding: 8, color: '#e2e8f0', borderTopWidth: 1, borderColor: '#334155' },
  bullet_list:{ marginBottom: 4 },
  list_item:  { color: '#e2e8f0', fontSize: 16 },
};

export default function QuizScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { unit }   = route.params;
  const { activeKid } = useAuth();
  const questions  = unit.questions ?? [];

  const [currentIndex, setCurrentIndex]   = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [score, setScore]                 = useState(0);
  const [answered, setAnswered]           = useState(false);
  const [finished, setFinished]           = useState(false);
  const [hintVisible, setHintVisible]     = useState(false);
  const [speaking, setSpeaking]           = useState(false);

  const progressAnim  = useRef(new Animated.Value(0)).current;
  const hintAnim      = useRef(new Animated.Value(0)).current;
  const answerTimeout = useRef(null);

  // Stop speech and reset hint when question changes
  useEffect(() => {
    Speech.stop();
    setSpeaking(false);
    setHintVisible(false);
    hintAnim.setValue(0);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (answerTimeout.current) clearTimeout(answerTimeout.current);
      Speech.stop();
    };
  }, []);

  const toggleHint = useCallback(() => {
    const next = !hintVisible;
    setHintVisible(next);
    Animated.timing(hintAnim, {
      toValue: next ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [hintVisible]);

  const toggleSpeech = useCallback(async () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
    } else {
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) { Speech.stop(); }
      const q = questions[currentIndex];
      const text = (q?.question ?? '').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
      Speech.speak(text || q?.question || '', {
        rate: 0.85,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
      setSpeaking(true);
    }
  }, [speaking, currentIndex, questions]);

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No questions yet</Text>
          <Text style={styles.emptyDesc}>This lesson doesn't have any questions. Try editing it from the Scan tab.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const q = questions[currentIndex];
  const safeCorrectIndex = Math.min(Math.max(q.correctIndex ?? 0, 0), (q.options?.length ?? 1) - 1);
  const isVisual = q.type === 'visual_mc';

  function animateProgress(toValue) {
    Animated.timing(progressAnim, {
      toValue,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }

  function handleAnswer(index) {
    if (answered) return;
    setSelectedIndex(index);
    setAnswered(true);
    Speech.stop();
    setSpeaking(false);

    const isCorrect = index === safeCorrectIndex;
    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(newScore);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const nextIndex = currentIndex + 1;
    animateProgress(nextIndex / questions.length);

    answerTimeout.current = setTimeout(() => {
      if (nextIndex >= questions.length) {
        setFinished(true);
        if (activeKid?.id) {
          const stars = getStars(newScore, questions.length);
          saveQuizResult({
            kidId:     activeKid.id,
            unitId:    unit.id ?? null,
            unitTitle: unit.title,
            score:     newScore,
            total:     questions.length,
            stars,
          }).catch(() => {});
        }
      } else {
        setCurrentIndex(nextIndex);
        setSelectedIndex(null);
        setAnswered(false);
      }
    }, 1400);
  }

  function restart() {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setScore(0);
    setAnswered(false);
    setFinished(false);
    setHintVisible(false);
    setSpeaking(false);
    Speech.stop();
    animateProgress(0);
  }

  function optionStyle(index) {
    if (!answered) return styles.optionBtn;
    if (index === safeCorrectIndex) return [styles.optionBtn, styles.optionCorrect];
    if (index === selectedIndex)    return [styles.optionBtn, styles.optionWrong];
    return [styles.optionBtn, styles.optionDimmed];
  }

  function optionTextStyle(index) {
    if (!answered) return styles.optionText;
    if (index === safeCorrectIndex || index === selectedIndex) return [styles.optionText, styles.optionTextLight];
    return [styles.optionText, styles.optionTextDimmed];
  }

  function optionLetterStyle(index) {
    if (!answered) return styles.letterBadge;
    if (index === safeCorrectIndex) return [styles.letterBadge, styles.letterBadgeCorrect];
    if (index === selectedIndex)    return [styles.letterBadge, styles.letterBadgeWrong];
    return [styles.letterBadge, styles.letterBadgeDimmed];
  }

  // ── Results screen ──────────────────────────────────────────
  if (finished) {
    const stars = getStars(score, questions.length);
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.resultsContainer}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.resultsCard}>
            <Text style={styles.resultsStars}>
              {stars >= 1 ? '⭐' : '☆'}{stars >= 2 ? '⭐' : '☆'}{stars >= 3 ? '⭐' : '☆'}
            </Text>
            <Text style={styles.resultsScore}>{score}/{questions.length}</Text>
            <Text style={styles.resultsLabel}>
              {stars === 3 ? 'Outstanding! 🎉' :
               stars === 2 ? 'Great work! 👏' :
               stars === 1 ? 'Good effort! 💪' :
               'Keep practicing! 📚'}
            </Text>
            <Text style={styles.resultsUnit}>{unit.title}</Text>
          </View>

          <TouchableOpacity style={styles.replayBtn} onPress={restart}>
            <Text style={styles.replayBtnText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.homeBtnText}>Back to Lessons</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Quiz screen ─────────────────────────────────────────────
  const progressWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{unit.title}</Text>
          <Text style={styles.headerCounter}>{currentIndex + 1} of {questions.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {/* Question + options */}
      <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>

        {/* Question card */}
        <View style={[styles.questionCard, isVisual && styles.questionCardVisual]}>
          {/* Card header row: label + TTS button */}
          <View style={styles.questionCardHeader}>
            <Text style={styles.questionNum}>
              {isVisual ? '✨ Visual Question' : `Question ${currentIndex + 1}`}
            </Text>
            <TouchableOpacity onPress={toggleSpeech} style={styles.ttsBtn} activeOpacity={0.7}>
              <Text style={[styles.ttsBtnIcon, speaking && styles.ttsBtnActive]}>
                {speaking ? '🔊' : '🔈'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SVG geometry (optional) */}
          {q.geometry && <GeometryDisplay geometry={q.geometry} />}

          {/* Question text — markdown rendered */}
          <Markdown style={isVisual ? mdStylesVisual : mdStyles}>
            {q?.question ?? ''}
          </Markdown>
        </View>

        {/* Hint */}
        {q.hint && (
          <View style={styles.hintRow}>
            <TouchableOpacity onPress={toggleHint} style={styles.hintBtn} activeOpacity={0.8}>
              <Text style={styles.hintBtnText}>
                {hintVisible ? '💡 Hide hint' : '💡 Show hint'}
              </Text>
            </TouchableOpacity>
            {hintVisible && (
              <Animated.View style={[styles.hintCard, { opacity: hintAnim }]}>
                <Text style={styles.hintText}>{q.hint}</Text>
              </Animated.View>
            )}
          </View>
        )}

        {/* Options */}
        <View style={styles.optionList}>
          {(q?.options ?? []).map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={optionStyle(i)}
              onPress={() => handleAnswer(i)}
              disabled={answered}
              activeOpacity={0.8}
            >
              <View style={optionLetterStyle(i)}>
                <Text style={styles.letterText}>{OPTION_LETTERS[i]}</Text>
              </View>
              <Text style={optionTextStyle(i)}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Markdown styles for visual questions (larger emoji-friendly size)
const mdStylesVisual = {
  ...mdStyles,
  body: { ...mdStyles.body, fontSize: 22, lineHeight: 36 },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerBack:     { width: 40, alignItems: 'flex-start' },
  headerBackText: { fontSize: 22, color: '#94a3b8' },
  headerCenter:   { flex: 1, alignItems: 'center' },
  headerTitle:    { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 1 },
  headerCounter:  { fontSize: 12, color: '#64748b' },

  // Progress
  progressTrack: { height: 4, backgroundColor: '#1e293b' },
  progressFill:  { height: 4, backgroundColor: '#60a5fa' },

  // Quiz content
  quizContent: { padding: 20, paddingBottom: 40 },

  questionCard: {
    backgroundColor: '#1e293b', borderRadius: 20,
    padding: 20, marginBottom: 16,
  },
  questionCardVisual: {
    padding: 22, borderWidth: 1, borderColor: '#312e81',
    backgroundColor: '#1a1a3e',
  },
  questionCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  questionNum: {
    fontSize: 12, fontWeight: '700', color: '#60a5fa',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // TTS button
  ttsBtn:       { padding: 4 },
  ttsBtnIcon:   { fontSize: 20, opacity: 0.6 },
  ttsBtnActive: { opacity: 1 },

  // Hint
  hintRow:  { marginBottom: 16 },
  hintBtn:  {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 8,
  },
  hintBtnText: { fontSize: 13, fontWeight: '700', color: '#fbbf24' },
  hintCard: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderLeftWidth: 3, borderLeftColor: '#fbbf24',
    borderRadius: 10, padding: 14,
  },
  hintText: { fontSize: 14, color: '#fde68a', lineHeight: 20 },

  optionList: { gap: 10 },

  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1e293b', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 2, borderColor: '#334155',
  },
  optionCorrect: { backgroundColor: '#14532d', borderColor: '#22c55e' },
  optionWrong:   { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  optionDimmed:  { opacity: 0.45 },

  letterBadge: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  letterBadgeCorrect: { backgroundColor: '#22c55e' },
  letterBadgeWrong:   { backgroundColor: '#ef4444' },
  letterBadgeDimmed:  { backgroundColor: '#1e293b' },
  letterText: { fontSize: 13, fontWeight: '800', color: '#94a3b8' },

  optionText:       { flex: 1, fontSize: 16, fontWeight: '600', color: '#e2e8f0', lineHeight: 22 },
  optionTextLight:  { color: '#fff' },
  optionTextDimmed: { color: '#475569' },

  // Results
  resultsContainer: {
    flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40,
  },
  backBtn:     { marginBottom: 16 },
  backBtnText: { fontSize: 16, color: '#64748b', fontWeight: '600' },

  resultsCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  resultsStars: { fontSize: 52, marginBottom: 16 },
  resultsScore: {
    fontSize: 72, fontWeight: '900', color: '#fff', lineHeight: 80,
  },
  resultsLabel: { fontSize: 22, fontWeight: '700', color: '#94a3b8', marginTop: 8, marginBottom: 6 },
  resultsUnit:  { fontSize: 14, color: '#475569', textAlign: 'center', maxWidth: 240 },

  replayBtn: {
    backgroundColor: '#2563eb', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center', marginBottom: 12,
  },
  replayBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  homeBtn:       { paddingVertical: 14, alignItems: 'center' },
  homeBtnText:   { fontSize: 15, color: '#64748b', fontWeight: '600' },

  // Empty state
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji:     { fontSize: 56, marginBottom: 16 },
  emptyTitle:     { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptyDesc:      { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyBtn:       { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText:   { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
});
