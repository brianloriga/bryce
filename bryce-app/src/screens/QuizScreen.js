import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import Markdown from '@ronradtke/react-native-markdown-display';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Image, Modal,
  KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { saveQuizResult } from '../services/supabase';
import { resolveSubject } from '../utils/subjects';
import { findGame, AVAILABLE_GAMES, GAME_REGISTRY } from '../minigames/registry';
import { getEnabledMap } from '../services/gameSettings';

// Shared utilities
import { OPTION_LETTERS, TYPE_LABELS, getStars, shuffleNoConsecutiveDupes } from '../utils/quizHelpers';

// Shared components
import ContextCard    from '../renderers/shared/ContextCard';
import GeometryDisplay from '../renderers/shared/GeometryDisplay';
import { mdStyles, mdStylesVisual } from '../renderers/shared/markdownStyles';

// Tool renderers (Enhanced Questions)
import ProtractorRenderer     from '../renderers/tools/ProtractorRenderer';
import RulerRenderer          from '../renderers/tools/RulerRenderer';
import NumberLineRenderer     from '../renderers/tools/NumberLineRenderer';
import AngleMatchingRenderer  from '../renderers/tools/AngleMatchingRenderer';
import CoinRenderer           from '../renderers/tools/CoinRenderer';

// Standard renderers
import FillInRenderer  from '../renderers/standard/FillInRenderer';
import OrderingRenderer from '../renderers/standard/OrderingRenderer';
import TrueFalseRenderer from '../renderers/standard/TrueFalseRenderer';
import WordBankRenderer  from '../renderers/standard/WordBankRenderer';

export default function QuizScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { unit }   = route.params;
  const { activeKid } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const [questions] = useState(() => shuffleNoConsecutiveDupes(unit.questions ?? []));

  const subjectColor = resolveSubject(unit.subject, [])?.color ?? '#60a5fa';

  const [currentIndex, setCurrentIndex]     = useState(0);
  const [selectedIndex, setSelectedIndex]   = useState(null);
  const [score, setScore]                   = useState(0);
  const [answered, setAnswered]             = useState(false);
  const [finished, setFinished]             = useState(false);
  const [hintVisible, setHintVisible]       = useState(false);
  const [passageVisible, setPassageVisible] = useState(false);
  const [zoomImage, setZoomImage]           = useState(null);
  const [enabledGames, setEnabledGames]     = useState({});
  const [scrollEnabled, setScrollEnabled]   = useState(true);

  useEffect(() => {
    getEnabledMap(GAME_REGISTRY.map(g => g.id)).then(setEnabledGames);
  }, []);

  const progressAnim  = useRef(new Animated.Value(0)).current;
  const hintAnim      = useRef(new Animated.Value(0)).current;
  const celebAnim     = useRef(new Animated.Value(1)).current;
  const answerTimeout = useRef(null);

  useEffect(() => {
    setHintVisible(false);
    hintAnim.setValue(0);
    celebAnim.setValue(1);
  }, [currentIndex]);

  useEffect(() => {
    return () => { if (answerTimeout.current) clearTimeout(answerTimeout.current); };
  }, []);

  const toggleHint = useCallback(() => {
    const next = !hintVisible;
    setHintVisible(next);
    Animated.timing(hintAnim, { toValue: next ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [hintVisible]);

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

  const q              = questions[currentIndex];
  const qType          = q.type ?? 'multiple_choice';
  const isMC           = !q.type || q.type === 'multiple_choice' || q.type === 'visual_mc';
  const isVisual       = q.type === 'visual_mc';
  const safeCorrectIdx = Math.min(Math.max(q.correctIndex ?? 0, 0), (q.options?.length ?? 1) - 1);

  // Compute badge label — tool questions show their specific mode name
  const typeLabel = (() => {
    if (q.measurementTool === 'protractor') {
      const mode = q.geometry?.protractorMode ?? 'align';
      return {
        read:         'Protractor · Read',
        build:        'Protractor · Build',
        align:        'Protractor · Align',
        estimate:     'Protractor · Estimate',
        spot_mistake: 'Spot the Mistake',
      }[mode] ?? 'Protractor';
    }
    if (q.measurementTool === 'coin') {
      const mode = q.geometry?.mode ?? 'count';
      return {
        count:        'Coin Count',
        make:         'Make the Amount',
        estimation:   'Coin Estimation',
        spot_mistake: 'Spot the Mistake',
        fewest:       'Fewest Coins',
      }[mode] ?? 'Money';
    }
    if (q.type === 'multiple_choice' && q.geometry?.type === 'angle') return 'Angle Type';
    if (q.measurementTool === 'ruler') return 'Ruler';
    return TYPE_LABELS[qType] ?? null;
  })();

  function resolveAnswer(isCorrect) {
    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(newScore);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(celebAnim, { toValue: 1.04, duration: 150, useNativeDriver: true }),
        Animated.timing(celebAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    const nextIndex = currentIndex + 1;
    animateProgress(nextIndex / questions.length);
    answerTimeout.current = setTimeout(() => {
      if (nextIndex >= questions.length) {
        setFinished(true);
        if (activeKid?.id) {
          saveQuizResult({
            kidId: activeKid.id, unitId: unit.id ?? null, unitTitle: unit.title,
            score: newScore, total: questions.length, stars: getStars(newScore, questions.length),
          }).catch(() => {});
        }
      } else {
        setCurrentIndex(nextIndex);
        setSelectedIndex(null);
        setAnswered(false);
      }
    }, 200);
  }

  function handleMCAnswer(index) {
    if (answered) return;
    setSelectedIndex(index);
    setAnswered(true);
    const isCorrect = index === safeCorrectIdx;
    const newScore  = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(newScore);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(celebAnim, { toValue: 1.04, duration: 150, useNativeDriver: true }),
        Animated.timing(celebAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    const nextIndex = currentIndex + 1;
    animateProgress(nextIndex / questions.length);
    answerTimeout.current = setTimeout(() => {
      if (nextIndex >= questions.length) {
        setFinished(true);
        if (activeKid?.id) {
          saveQuizResult({
            kidId: activeKid.id, unitId: unit.id ?? null, unitTitle: unit.title,
            score: newScore, total: questions.length, stars: getStars(newScore, questions.length),
          }).catch(() => {});
        }
      } else {
        setCurrentIndex(nextIndex);
        setSelectedIndex(null);
        setAnswered(false);
      }
    }, 1400);
  }

  function animateProgress(toValue) {
    Animated.timing(progressAnim, { toValue, duration: 400, useNativeDriver: false }).start();
  }

  function restart() {
    setCurrentIndex(0); setSelectedIndex(null); setScore(0);
    setAnswered(false); setFinished(false); setHintVisible(false);
    animateProgress(0);
  }

  function mcOptionStyle(index) {
    if (!answered) return styles.optionBtn;
    if (index === safeCorrectIdx) return [styles.optionBtn, styles.optionCorrect];
    if (index === selectedIndex)  return [styles.optionBtn, styles.optionWrong];
    return [styles.optionBtn, styles.optionDimmed];
  }
  function mcOptionTextStyle(index) {
    if (!answered) return styles.optionText;
    if (index === safeCorrectIdx || index === selectedIndex) return [styles.optionText, styles.optionTextLight];
    return [styles.optionText, styles.optionTextDimmed];
  }
  function mcLetterStyle(index) {
    if (!answered) return styles.letterBadge;
    if (index === safeCorrectIdx) return [styles.letterBadge, styles.letterBadgeCorrect];
    if (index === selectedIndex)  return [styles.letterBadge, styles.letterBadgeWrong];
    return [styles.letterBadge, styles.letterBadgeDimmed];
  }

  // ── Results screen ───────────────────────────────────────────
  if (finished) {
    const stars         = getStars(score, questions.length);
    const pct           = score / questions.length;
    const hasMCQuestions = questions.some(q => Array.isArray(q.options) && q.options.length >= 2);
    const configuredId   = unit.reward_config?.game;
    const defaultGame    = hasMCQuestions
      ? (AVAILABLE_GAMES.find(g => enabledGames[g.id] !== false) ?? null)
      : null;
    const rewardGame     = configuredId
      ? (enabledGames[configuredId] !== false ? findGame(configuredId) : null)
      : defaultGame;
    const rewardUnlocked = pct >= 0.70 && !!rewardGame;
    const gameLabel      = rewardGame?.label ?? '';

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
              {stars === 3 ? 'Outstanding! 🎉' : stars === 2 ? 'Great work! 👏' : stars === 1 ? 'Good effort! 💪' : 'Keep practicing! 📚'}
            </Text>
            <Text style={styles.resultsUnit}>{unit.title}</Text>
          </View>

          {rewardUnlocked && (
            <TouchableOpacity
              style={styles.rewardUnlockBtn}
              onPress={() => navigation.navigate(rewardGame.routeName, { unit })}
              activeOpacity={0.85}>
              <View style={styles.rewardUnlockLeft}>
                <Text style={styles.rewardUnlockEmoji}>{rewardGame?.emoji ?? '🎮'}</Text>
                <View>
                  <Text style={styles.rewardUnlockTitle}>{gameLabel} Unlocked!</Text>
                  <Text style={styles.rewardUnlockSub}>{rewardGame?.description ?? 'Play now!'}</Text>
                </View>
              </View>
              <Text style={styles.rewardUnlockChevron}>›</Text>
            </TouchableOpacity>
          )}

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

  // ── Quiz screen ──────────────────────────────────────────────
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={[styles.subjectAccent, { backgroundColor: subjectColor }]} />

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

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          style={Platform.OS === 'web' ? { height: windowHeight - 120 } : undefined}
          contentContainerStyle={styles.quizContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}>

          {q.context && <ContextCard context={q.context} accentColor={subjectColor} />}

          <Animated.View style={[
            styles.questionCard,
            isVisual && styles.questionCardVisual,
            { borderTopColor: subjectColor, transform: [{ scale: celebAnim }] },
          ]}>
            <View style={styles.questionCardHeader}>
              <View style={[styles.typeBadge, { borderColor: subjectColor + '60', backgroundColor: subjectColor + '18' }]}>
                <Text style={[styles.typeBadgeText, { color: subjectColor }]}>
                  {typeLabel ?? (isVisual ? 'Visual Question' : `Question ${currentIndex + 1}`)}
                </Text>
              </View>
            </View>

            {q.image_url && (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomImage(q.image_url)} style={styles.questionImageWrap}>
                <Image source={{ uri: q.image_url }} style={styles.questionImage} resizeMode="cover" />
                <View style={styles.zoomHint}>
                  <Ionicons name="expand-outline" size={14} color="#fff" />
                  <Text style={styles.zoomHintText}>Tap to enlarge</Text>
                </View>
              </TouchableOpacity>
            )}
            {q.geometry && <GeometryDisplay geometry={q.geometry} />}

            <Markdown style={isVisual ? mdStylesVisual : mdStyles}>
              {q?.question ?? ''}
            </Markdown>
          </Animated.View>

          {q.hint && (
            <View style={styles.hintRow}>
              <TouchableOpacity onPress={toggleHint} style={styles.hintBtn} activeOpacity={0.8}>
                <Text style={styles.hintBtnText}>{hintVisible ? '💡 Hide hint' : '💡 Show hint'}</Text>
              </TouchableOpacity>
              {hintVisible && (
                <Animated.View style={[styles.hintCard, { opacity: hintAnim }]}>
                  <Text style={styles.hintText}>{q.hint}</Text>
                </Animated.View>
              )}
            </View>
          )}

          {/* ── Renderer dispatch ── */}
          {isMC ? (
            <View style={styles.optionList}>
              {(q?.options ?? []).map((opt, i) => (
                <TouchableOpacity key={i} style={mcOptionStyle(i)} onPress={() => handleMCAnswer(i)} disabled={answered} activeOpacity={0.8}>
                  <View style={mcLetterStyle(i)}>
                    <Text style={styles.letterText}>{OPTION_LETTERS[i]}</Text>
                  </View>
                  <Text style={mcOptionTextStyle(i)}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : qType === 'fill_in' && q.measurementTool === 'protractor' ? (
            <ProtractorRenderer  key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} setScrollEnabled={setScrollEnabled} />
          ) : qType === 'fill_in' && q.measurementTool === 'ruler' ? (
            <RulerRenderer       key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} setScrollEnabled={setScrollEnabled} />
          ) : qType === 'fill_in' && q.measurementTool === 'coin' ? (
            <CoinRenderer        key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : qType === 'fill_in' ? (
            <FillInRenderer      key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : qType === 'number_line' ? (
            <NumberLineRenderer  key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} setScrollEnabled={setScrollEnabled} />
          ) : qType === 'ordering' ? (
            <OrderingRenderer    key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : qType === 'true_false' ? (
            <TrueFalseRenderer   key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : qType === 'word_bank' ? (
            <WordBankRenderer        key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : qType === 'angle_matching' ? (
            <AngleMatchingRenderer   key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : null}

          {unit.passage && (
            <TouchableOpacity style={styles.readAlongBar} onPress={() => setPassageVisible(true)} activeOpacity={0.8}>
              <Text style={styles.readAlongIcon}>📖</Text>
              <View style={styles.readAlongTextBlock}>
                <Text style={styles.readAlongLabel}>Read Along</Text>
                <Text style={styles.readAlongSub}>Open the reading to help answer</Text>
              </View>
              <Text style={styles.readAlongChevron}>›</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Image zoom modal */}
      <Modal visible={!!zoomImage} transparent animationType="fade" onRequestClose={() => setZoomImage(null)}>
        <TouchableOpacity style={styles.zoomOverlay} activeOpacity={1} onPress={() => setZoomImage(null)}>
          <View style={styles.zoomContainer}>
            <Image source={{ uri: zoomImage }} style={styles.zoomImage} resizeMode="contain" />
            <TouchableOpacity style={styles.zoomCloseBtn} onPress={() => setZoomImage(null)}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reading Passage modal */}
      {unit.passage && (
        <Modal visible={passageVisible} transparent animationType="slide" onRequestClose={() => setPassageVisible(false)}>
          <TouchableOpacity style={styles.passageOverlay} activeOpacity={1} onPress={() => setPassageVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.passageSheet}>
              <View style={styles.passageHandle} />
              <View style={styles.passageModalHeader}>
                <Text style={styles.passageModalTitle}>📖 Reading Passage</Text>
                <TouchableOpacity onPress={() => setPassageVisible(false)}>
                  <Text style={styles.passageCloseX}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.passageModalHint}>Use this text to help answer the questions.</Text>
              <ScrollView style={styles.passageScroll} showsVerticalScrollIndicator>
                <Text style={styles.passageBody}>{unit.passage}</Text>
              </ScrollView>
              <TouchableOpacity style={styles.passageDoneBtn} onPress={() => setPassageVisible(false)}>
                <Text style={styles.passageDoneBtnText}>Back to Quiz</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },

  subjectAccent: { height: 3 },

  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  headerBack:     { width: 40, alignItems: 'flex-start' },
  headerBackText: { fontSize: 22, color: '#94a3b8' },
  headerCenter:   { flex: 1, alignItems: 'center' },
  headerTitle:    { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 1 },
  headerCounter:  { fontSize: 12, color: '#64748b' },

  progressTrack: { height: 4, backgroundColor: '#1e293b' },
  progressFill:  { height: 4, backgroundColor: '#60a5fa' },

  quizContent: { padding: 20, paddingBottom: 48 },

  questionCard: {
    backgroundColor: '#1e293b', borderRadius: 20,
    padding: 20, marginBottom: 16, borderTopWidth: 3,
  },
  questionCardVisual: {
    padding: 22, borderWidth: 1, borderTopWidth: 3,
    borderColor: '#312e81', backgroundColor: '#1a1a3e',
  },
  questionCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },

  typeBadge:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

  questionImageWrap: { width: '100%', marginBottom: 14, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1e293b' },
  questionImage:     { width: '100%', height: 180 },
  zoomHint: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  zoomHintText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  zoomOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  zoomContainer: { width: '100%', height: '85%' },
  zoomImage:     { width: '100%', height: '100%' },
  zoomCloseBtn: {
    position: 'absolute', top: 12, right: 16,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },

  readAlongBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 10, marginBottom: 6, marginHorizontal: 4,
    paddingVertical: 13, paddingHorizontal: 16,
    backgroundColor: 'rgba(96,165,250,0.07)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(96,165,250,0.18)',
  },
  readAlongIcon:      { fontSize: 24 },
  readAlongTextBlock: { flex: 1 },
  readAlongLabel:     { fontSize: 14, fontWeight: '700', color: '#60a5fa' },
  readAlongSub:       { fontSize: 11, color: '#475569', marginTop: 1 },
  readAlongChevron:   { fontSize: 22, color: '#60a5fa', fontWeight: '300' },

  passageOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  passageSheet:       { backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#1e293b', padding: 24, paddingBottom: 36, maxHeight: '80%' },
  passageHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155', alignSelf: 'center', marginBottom: 20 },
  passageModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  passageModalTitle:  { fontSize: 18, fontWeight: '800', color: '#fff' },
  passageCloseX:      { fontSize: 18, color: '#64748b', padding: 4 },
  passageModalHint:   { fontSize: 13, color: '#64748b', marginBottom: 16 },
  passageScroll:      { maxHeight: 340, marginBottom: 20 },
  passageBody:        { fontSize: 15, color: '#e2e8f0', lineHeight: 24 },
  passageDoneBtn:     { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  passageDoneBtnText: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },

  hintRow:     { marginBottom: 16 },
  hintBtn:     { alignSelf: 'flex-start', backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8 },
  hintBtnText: { fontSize: 13, fontWeight: '700', color: '#fbbf24' },
  hintCard:    { backgroundColor: 'rgba(251,191,36,0.08)', borderLeftWidth: 3, borderLeftColor: '#fbbf24', borderRadius: 10, padding: 14 },
  hintText:    { fontSize: 14, color: '#fde68a', lineHeight: 20 },

  optionList: { gap: 10 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1e293b', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 2, borderColor: '#334155',
  },
  optionCorrect:       { backgroundColor: '#14532d', borderColor: '#22c55e' },
  optionWrong:         { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  optionDimmed:        { opacity: 0.45 },
  letterBadge:         { width: 32, height: 32, borderRadius: 10, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  letterBadgeCorrect:  { backgroundColor: '#22c55e' },
  letterBadgeWrong:    { backgroundColor: '#ef4444' },
  letterBadgeDimmed:   { backgroundColor: '#1e293b' },
  letterText:          { fontSize: 13, fontWeight: '800', color: '#94a3b8' },
  optionText:          { flex: 1, fontSize: 16, fontWeight: '600', color: '#e2e8f0', lineHeight: 22 },
  optionTextLight:     { color: '#fff' },
  optionTextDimmed:    { color: '#475569' },

  // Shared renderer styles — passed as the `styles` prop to all renderers
  fillInBox:           { borderWidth: 2, borderColor: '#334155', borderRadius: 14, backgroundColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 4, marginBottom: 10 },
  fillInBoxCorrect:    { borderColor: '#22c55e', backgroundColor: '#14532d' },
  fillInBoxWrong:      { borderColor: '#ef4444', backgroundColor: '#7f1d1d' },
  fillInInput:         { fontSize: 22, fontWeight: '700', color: '#f1f5f9', paddingVertical: 14 },
  fillInSubmit:        { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', marginTop: 4 },
  fillInSubmitText:    { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  fillInReveal:        { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6, marginBottom: 4 },
  fillInRevealLabel:   { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  fillInRevealAnswer:  { fontSize: 15, fontWeight: '800', color: '#f87171' },
  fillInCorrectMsg:    { fontSize: 15, fontWeight: '700', color: '#4ade80', marginTop: 6 },

  orderingLabel:       { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10, marginTop: 4 },
  orderingSlots:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  orderingSlot:        { minWidth: 72, minHeight: 52, borderRadius: 12, borderWidth: 2, borderColor: '#334155', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', padding: 6 },
  orderingSlotCorrect: { borderColor: '#22c55e', backgroundColor: '#14532d33' },
  orderingSlotWrong:   { borderColor: '#ef4444', backgroundColor: '#7f1d1d33' },
  orderingSlotNum:     { fontSize: 10, fontWeight: '800', color: '#475569', position: 'absolute', top: 4, left: 6 },
  orderingSlotText:    { fontSize: 15, fontWeight: '700', color: '#e2e8f0', textAlign: 'center' },
  orderingChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  orderingChip:        { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.04)' },
  orderingChipUsed:    { opacity: 0.25 },
  orderingChipText:    { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  orderingChipTextUsed:{ color: '#475569' },
  orderingClear:       { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 },
  orderingClearText:   { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  orderingReveal:      { marginTop: 10, padding: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#ef4444' },

  tfRow:         { flexDirection: 'row', gap: 12, marginTop: 4 },
  tfTrue:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 2, borderColor: 'rgba(34,197,94,0.4)' },
  tfFalse:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 2, borderColor: 'rgba(239,68,68,0.4)' },
  tfTrueCorrect: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: '#14532d', borderWidth: 2, borderColor: '#22c55e' },
  tfFalseCorrect:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: '#14532d', borderWidth: 2, borderColor: '#22c55e' },
  tfTrueWrong:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: '#7f1d1d', borderWidth: 2, borderColor: '#ef4444' },
  tfFalseWrong:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: '#7f1d1d', borderWidth: 2, borderColor: '#ef4444' },
  tfDimmed:      { opacity: 0.3 },
  tfBtnText:     { fontSize: 20, fontWeight: '800', color: '#fff' },

  wbBankLabel:    { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  wbBank:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  wbChip:         { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155' },
  wbChipSelected: { borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.15)' },
  wbChipCorrect:  { backgroundColor: '#14532d', borderColor: '#22c55e' },
  wbChipWrong:    { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  wbChipDim:      { opacity: 0.35 },
  wbChipText:     { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
  wbSentenceCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  wbSentence:     { fontSize: 22, fontWeight: '600', color: '#f1f5f9', lineHeight: 36 },
  wbBlank:        { fontSize: 22, fontWeight: '800', color: '#475569' },
  wbBlankFilled:  { color: '#60a5fa' },
  wbBlankCorrect: { color: '#4ade80' },
  wbBlankWrong:   { color: '#f87171' },
  wbClear:        { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, marginTop: 4 },
  wbClearText:    { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  resultsContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  backBtn:          { marginBottom: 16 },
  backBtnText:      { fontSize: 16, color: '#64748b', fontWeight: '600' },
  resultsCard:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resultsStars:     { fontSize: 52, marginBottom: 16 },
  resultsScore:     { fontSize: 72, fontWeight: '900', color: '#fff', lineHeight: 80 },
  resultsLabel:     { fontSize: 22, fontWeight: '700', color: '#94a3b8', marginTop: 8, marginBottom: 6 },
  resultsUnit:      { fontSize: 14, color: '#475569', textAlign: 'center', maxWidth: 240 },
  rewardUnlockBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(37,99,235,0.18)', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 14, borderWidth: 2, borderColor: 'rgba(59,130,246,0.5)' },
  rewardUnlockLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rewardUnlockEmoji:{ fontSize: 30 },
  rewardUnlockTitle:{ fontSize: 16, fontWeight: '800', color: '#93c5fd', marginBottom: 2 },
  rewardUnlockSub:  { fontSize: 12, color: '#475569', fontWeight: '600' },
  rewardUnlockChevron: { fontSize: 28, color: '#3b82f6', fontWeight: '300' },
  replayBtn:        { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  replayBtnText:    { fontSize: 17, fontWeight: '700', color: '#fff' },
  homeBtn:          { paddingVertical: 14, alignItems: 'center' },
  homeBtnText:      { fontSize: 15, color: '#64748b', fontWeight: '600' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji:     { fontSize: 56, marginBottom: 16 },
  emptyTitle:     { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptyDesc:      { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyBtn:       { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText:   { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
});
