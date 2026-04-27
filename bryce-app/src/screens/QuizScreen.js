import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Markdown from '@ronradtke/react-native-markdown-display';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Image, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { saveQuizResult, supabase } from '../services/supabase';
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
import ClockRenderer          from '../renderers/tools/ClockRenderer';
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

  // Intro phase — shown before Q1 when intro_audio_url is available.
  // liveIntroUrl starts from the nav-param value, then gets updated by a
  // background fetch so the intro also works the very first time the lesson
  // is opened (before the home screen has refreshed its unit list).
  const [liveIntroUrl, setLiveIntroUrl]       = useState(unit.intro_audio_url ?? null);
  const [introImageUrls, setIntroImageUrls]   = useState(unit.intro_image_urls ?? []);
  // Show intro screen if lesson_intro text exists (even before audio URL is ready)
  const [introPhase, setIntroPhase]           = useState(!!unit.lesson_intro || !!unit.intro_audio_url);
  const [audioLoading, setAudioLoading]       = useState(!!unit.lesson_intro && !unit.intro_audio_url);
  const [introPlaying, setIntroPlaying]       = useState(false);
  const [introFinished, setIntroFinished]     = useState(false);
  const introSoundRef = useRef(null);

  // Intro animations
  const introCardAnim     = useRef(new Animated.Value(0)).current; // entrance (0→1)
  const introPulseAnim    = useRef(new Animated.Value(1)).current; // icon ring pulse
  const introWaveAnims    = useRef([0,1,2,3,4].map(() => new Animated.Value(0.3))).current;
  const introProgressAnim = useRef(new Animated.Value(0)).current; // playback bar (0→1)
  // Photo Ken Burns: each image has its own scale + opacity anim
  const introPhotoAnims = useRef([0,1,2].map(() => ({
    opacity: new Animated.Value(0),
    scale:   new Animated.Value(1.08),
  }))).current;
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const photoTimerRef = useRef(null);

  useEffect(() => {
    getEnabledMap(GAME_REGISTRY.map(g => g.id)).then(setEnabledGames);
  }, []);

  // Poll for intro_audio_url while on the intro screen.
  // Starts immediately since the intro screen is already showing — no need to delay.
  useEffect(() => {
    if (liveIntroUrl || !unit.id || !unit.lesson_intro) return;
    let cancelled = false;
    let attempts  = 0;
    const MAX     = 12; // 12 × 2s = 24s total

    async function poll() {
      if (cancelled || attempts >= MAX) return;
      attempts++;
      try {
        const { data } = await supabase
          .from('custom_units')
          .select('intro_audio_url, intro_image_urls')
          .eq('id', unit.id)
          .single();
        if (cancelled) return;
        if (data?.intro_audio_url) {
          setLiveIntroUrl(data.intro_audio_url);
          setAudioLoading(false);
          if (Array.isArray(data.intro_image_urls) && data.intro_image_urls.length > 0) {
            setIntroImageUrls(data.intro_image_urls);
          }
        } else {
          setTimeout(poll, 2000);
        }
      } catch {
        if (attempts >= MAX) setAudioLoading(false); // give up gracefully
        else setTimeout(poll, 2000);
      }
    }

    poll(); // start immediately — user is already on the intro screen
    return () => { cancelled = true; };
  }, [unit.id, unit.lesson_intro]);

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

  useEffect(() => {
    return () => {
      if (introSoundRef.current) {
        introSoundRef.current.unloadAsync().catch(() => {});
      }
      if (photoTimerRef.current) clearTimeout(photoTimerRef.current);
    };
  }, []);

  // Entrance animation — fires when intro phase is active
  useEffect(() => {
    if (!introPhase) return;
    introCardAnim.setValue(0);
    Animated.spring(introCardAnim, {
      toValue: 1, tension: 60, friction: 9, useNativeDriver: true,
    }).start();
  }, [introPhase]);

  // Wave bars + pulse — run while playing, stop when paused
  useEffect(() => {
    if (introPlaying) {
      // Staggered wave bars: each bar loops at a slightly different speed
      const speeds = [420, 340, 500, 370, 450];
      const loops  = introWaveAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1,   duration: speeds[i],       useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.15, duration: speeds[i] * 0.8, useNativeDriver: true }),
          ])
        )
      );
      // Stagger start times so bars don't all move in sync
      loops.forEach((loop, i) => setTimeout(() => loop.start(), i * 80));

      // Pulsing glow ring on icon
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(introPulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
          Animated.timing(introPulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();

      return () => {
        loops.forEach(l => l.stop());
        pulse.stop();
        introPulseAnim.setValue(1);
        introWaveAnims.forEach(a => a.setValue(0.3));
      };
    }
  }, [introPlaying]);

  // Photo crossfade — cycles through up to 3 images, Ken Burns on each
  useEffect(() => {
    if (introImageUrls.length === 0) return;

    // Fade in first photo immediately
    Animated.parallel([
      Animated.timing(introPhotoAnims[0].opacity, { toValue: 1,    duration: 600,  useNativeDriver: true }),
      Animated.timing(introPhotoAnims[0].scale,   { toValue: 1,    duration: 5000, useNativeDriver: true }),
    ]).start();

    if (introImageUrls.length < 2) return;

    let current = 0;
    function cyclePhoto() {
      const next = (current + 1) % introImageUrls.length;
      // Reset next photo's scale before fading it in
      introPhotoAnims[next].scale.setValue(1.08);
      Animated.parallel([
        // Fade in next
        Animated.timing(introPhotoAnims[next].opacity, { toValue: 1,    duration: 800,  useNativeDriver: true }),
        Animated.timing(introPhotoAnims[next].scale,   { toValue: 1,    duration: 5000, useNativeDriver: true }),
        // Fade out current
        Animated.timing(introPhotoAnims[current].opacity, { toValue: 0, duration: 800,  useNativeDriver: true }),
      ]).start();
      current = next;
      setActivePhotoIdx(next);
      photoTimerRef.current = setTimeout(cyclePhoto, 4500);
    }

    photoTimerRef.current = setTimeout(cyclePhoto, 4500);
    return () => { if (photoTimerRef.current) clearTimeout(photoTimerRef.current); };
  }, [introImageUrls]);

  async function playIntroAudio() {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (introSoundRef.current) {
        await introSoundRef.current.unloadAsync().catch(() => {});
        introSoundRef.current = null;
      }
      setIntroPlaying(true);
      const { sound } = await Audio.Sound.createAsync(
        { uri: liveIntroUrl },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.durationMillis) {
            const pct = status.positionMillis / status.durationMillis;
            introProgressAnim.setValue(Math.min(pct, 1));
          }
          if (status.didJustFinish) {
            introProgressAnim.setValue(1);
            setIntroPlaying(false);
            setIntroFinished(true);
          }
        },
      );
      introSoundRef.current = sound;
    } catch {
      setIntroPlaying(false);
    }
  }

  async function stopIntroAudio() {
    if (introSoundRef.current) {
      await introSoundRef.current.stopAsync().catch(() => {});
      await introSoundRef.current.unloadAsync().catch(() => {});
      introSoundRef.current = null;
    }
    introProgressAnim.setValue(0);
    setIntroPlaying(false);
  }

  function startQuiz() {
    stopIntroAudio();
    setIntroPhase(false);
  }

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
    if (q.measurementTool === 'clock') {
      const mode = q.geometry?.clockMode ?? 'read';
      return {
        read:         'Clock · Read',
        set:          'Clock · Set',
        estimate:     'Clock · Estimate',
        spot_mistake: 'Clock · Spot the Mistake',
      }[mode] ?? 'Clock';
    }
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

  // ── Intro phase ──────────────────────────────────────────────
  if (introPhase) {
    const cardTranslate = introCardAnim.interpolate({ inputRange: [0, 1], outputRange: [56, 0] });
    const cardOpacity   = introCardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const hasPhotos     = introImageUrls.length > 0;

    return (
      <View style={styles.introScreen}>
        <StatusBar style="light" />

        {/* ── Full-bleed photos — no overlay, full brightness ── */}
        {hasPhotos ? (
          introImageUrls.map((url, i) => (
            <Animated.Image
              key={url}
              source={{ uri: url }}
              style={[
                styles.introBgPhoto,
                {
                  opacity:   introPhotoAnims[i]?.opacity ?? new Animated.Value(0),
                  transform: [{ scale: introPhotoAnims[i]?.scale ?? new Animated.Value(1) }],
                },
              ]}
              resizeMode="cover"
            />
          ))
        ) : (
          <View style={[styles.introBgPhoto, { backgroundColor: '#0f172a' }]} />
        )}

        {/* ── Glass header bar ── */}
        <SafeAreaView style={styles.introSafeArea}>
          <BlurView intensity={55} tint="dark" style={styles.introGlassHeader}>
            <View style={styles.introGlassHeaderInner}>
              <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              <Text style={styles.introGlassHeaderTitle} numberOfLines={1}>{unit.title}</Text>
              <View style={{ width: 24 }} />
            </View>
          </BlurView>

          {/* ── Glass card ── */}
          <Animated.View style={[
            styles.introCardWrap,
            { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] },
          ]}>
            <BlurView intensity={75} tint="dark" style={styles.introGlassCard}>

              {/* Icon */}
              <Animated.View style={[styles.introIconCircle, { transform: [{ scale: introPulseAnim }] }]}>
                <Ionicons
                  name={introPlaying ? 'volume-high' : 'school-outline'}
                  size={34}
                  color="rgba(255,255,255,0.9)"
                />
              </Animated.View>

              <Text style={styles.introCardLabel}>Lesson Intro</Text>
              <Text style={styles.introCardTitle}>{unit.title}</Text>
              <Text style={styles.introCardSub}>
                {introFinished ? 'Great! Ready to show what you know?' : 'Listen to a quick overview before you begin.'}
              </Text>

              {/* Wave bars */}
              <View style={styles.introWaveRow}>
                {introWaveAnims.map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.introWaveBar,
                      {
                        transform: [{ scaleY: anim }],
                        opacity: introPlaying ? 1 : 0.25,
                        height: 36 + (i % 3) * 8,
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Play button */}
              <TouchableOpacity
                style={styles.introPlayBtn}
                onPress={audioLoading ? undefined : introPlaying ? stopIntroAudio : playIntroAudio}
                activeOpacity={audioLoading ? 1 : 0.75}
              >
                {audioLoading ? (
                  <>
                    <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
                    <Text style={styles.introPlayLabel}>Preparing audio...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={introPlaying ? 'pause-circle' : introFinished ? 'refresh-circle' : 'play-circle'}
                      size={68}
                      color={introPlaying ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.75)'}
                    />
                    <Text style={styles.introPlayLabel}>
                      {introPlaying ? 'Tap to pause' : introFinished ? 'Play again' : 'Tap to listen'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Progress bar */}
              <View style={styles.introProgressTrack}>
                <Animated.View style={[
                  styles.introProgressFill,
                  { width: introProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]} />
              </View>

            </BlurView>
          </Animated.View>

          {/* ── Glass action buttons ── */}
          <Animated.View style={[styles.introActions, { opacity: cardOpacity }]}>
            <BlurView intensity={65} tint="dark" style={styles.introStartGlass}>
              <TouchableOpacity style={styles.introStartInner} onPress={startQuiz} activeOpacity={0.8}>
                <Text style={styles.introStartBtnText}>
                  {introFinished ? "Let's Go!" : 'Start Quiz'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </BlurView>

            <TouchableOpacity style={styles.introSkipBtn} onPress={startQuiz}>
              <Text style={styles.introSkipText}>Skip intro</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
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
          ) : qType === 'fill_in' && q.measurementTool === 'clock' ? (
            <ClockRenderer       key={currentIndex} q={q} onResolve={resolveAnswer} setScrollEnabled={setScrollEnabled} />
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

  // ── Intro phase — visionOS glass
  introScreen:        { flex: 1, backgroundColor: '#000' },
  introSafeArea:      { flex: 1, paddingHorizontal: 20, paddingBottom: 24 },
  introBgPhoto:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Glass header
  introGlassHeader:   { borderRadius: 18, marginTop: 8, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  introGlassHeaderInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  introGlassHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center', marginHorizontal: 8 },

  // Glass card
  introCardWrap:      { marginBottom: 16 },
  introGlassCard:     { borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 28, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  introIconCircle:    { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  introCardLabel:     { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  introCardTitle:     { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center', lineHeight: 28 },
  introCardSub:       { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  introWaveRow:       { flexDirection: 'row', gap: 6, alignItems: 'center', height: 52, marginBottom: 20 },
  introWaveBar:       { width: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)' },
  introPlayBtn:       { alignItems: 'center', gap: 6 },
  introPlayLabel:     { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3 },
  introProgressTrack: { width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginTop: 22, overflow: 'hidden' },
  introProgressFill:  { height: '100%', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 2 },

  // Glass action buttons
  introActions:       { gap: 0 },
  introStartGlass:    { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginBottom: 4 },
  introStartInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 24 },
  introStartBtnText:  { fontSize: 17, fontWeight: '800', color: '#fff' },
  introSkipBtn:       { paddingVertical: 14, alignSelf: 'center' },
  introSkipText:      { fontSize: 14, color: 'rgba(255,255,255,0.38)', fontWeight: '600' },
});
