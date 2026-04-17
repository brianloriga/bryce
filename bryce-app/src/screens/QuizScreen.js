import React, { useState, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
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

export default function QuizScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { unit }   = route.params;
  const { activeKid } = useAuth();
  const questions  = unit.questions ?? [];

  const [currentIndex, setCurrentIndex]   = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);  // which option was tapped
  const [score, setScore]                 = useState(0);
  const [answered, setAnswered]           = useState(false);
  const [finished, setFinished]           = useState(false);

  const progressAnim  = useRef(new Animated.Value(0)).current;
  const answerTimeout = useRef(null);

  useEffect(() => {
    return () => { if (answerTimeout.current) clearTimeout(answerTimeout.current); };
  }, []);

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No questions yet</Text>
          <Text style={styles.emptyDesc}>This unit doesn't have any questions. Try editing it from the Scan tab.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const q = questions[currentIndex];
  const safeCorrectIndex = Math.min(Math.max(q.correctIndex ?? 0, 0), (q.options?.length ?? 1) - 1);

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
        // Fire-and-forget — don't block the results screen on network
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
            <Text style={styles.homeBtnText}>Back to Units</Text>
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
        <View style={styles.questionCard}>
          <Text style={styles.questionNum}>Question {currentIndex + 1}</Text>
          <Text style={styles.questionText}>{q?.question}</Text>
        </View>

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
  progressTrack: {
    height: 4, backgroundColor: '#1e293b', marginHorizontal: 0,
  },
  progressFill: {
    height: 4, backgroundColor: '#60a5fa',
  },

  // Quiz content
  quizContent: { padding: 20, paddingBottom: 40 },

  questionCard: {
    backgroundColor: '#1e293b', borderRadius: 20,
    padding: 24, marginBottom: 24,
  },
  questionNum: {
    fontSize: 12, fontWeight: '700', color: '#60a5fa',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  questionText: {
    fontSize: 20, fontWeight: '700', color: '#f1f5f9', lineHeight: 30,
  },

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
