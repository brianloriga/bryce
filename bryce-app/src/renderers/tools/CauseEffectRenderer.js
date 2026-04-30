import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

const SUCCESS_LOTTIE = require('../../../assets/lottie-animations/Success.json');

// ── Pair accent colors ────────────────────────────────────────────
const PAIR_COLORS = [
  { bg: '#052e16', border: '#4ade80', text: '#4ade80' },
  { bg: '#1e3a5f', border: '#60a5fa', text: '#60a5fa' },
  { bg: '#431407', border: '#fb923c', text: '#fb923c' },
  { bg: '#2e1065', border: '#c084fc', text: '#c084fc' },
];
function pairColor(idx) {
  return PAIR_COLORS[idx % PAIR_COLORS.length];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── ShakeView ─────────────────────────────────────────────────────
function ShakeView({ isShaking, children, onLayout }) {
  const anim  = React.useRef(new Animated.Value(0)).current;
  const fired = React.useRef(false);

  if (isShaking && !fired.current) {
    fired.current = true;
    Animated.sequence([
      Animated.timing(anim, { toValue:  8, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue:  5, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  } else if (!isShaking) {
    fired.current = false;
  }

  return (
    <Animated.View style={{ transform: [{ translateX: anim }] }} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

// ── PulseView — gently pulses opacity to draw attention ───────────
function PulseView({ active, children }) {
  const anim = useRef(new Animated.Value(1)).current;
  const loop = useRef(null);

  useEffect(() => {
    if (active) {
      loop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.45, duration: 600, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.current.start();
    } else {
      loop.current?.stop();
      anim.setValue(1);
    }
  }, [active]);

  return <Animated.View style={{ opacity: anim }}>{children}</Animated.View>;
}

// ── EmojiChip ─────────────────────────────────────────────────────
// Renders a chip with an optional emoji bubble on the left.
function EmojiChip({ text, emoji, chipStyle, textStyle, isLocked, checkColor }) {
  return (
    <View style={[ceStyles.chip, chipStyle]}>
      {emoji ? (
        <View style={ceStyles.emojiWrap}>
          <Text style={ceStyles.emojiText}>{emoji}</Text>
        </View>
      ) : null}
      {isLocked && (
        <Text style={[ceStyles.checkMark, { color: checkColor }]}>✓ </Text>
      )}
      <Text style={[ceStyles.chipText, textStyle]} numberOfLines={3}>
        {text}
      </Text>
    </View>
  );
}

// ── Main renderer ─────────────────────────────────────────────────
export default function CauseEffectRenderer({ q, onResolve }) {
  const pairs = q.geometry?.pairs ?? [];

  const causeOrder  = useMemo(() => shuffle(pairs.map((_, i) => i)), []);
  const effectOrder = useMemo(() => shuffle(pairs.map((_, i) => i)), []);

  const [selectedCause, setSelectedCause] = useState(null);
  const [locked,        setLocked]        = useState(() => new Set());
  const [shaking,       setShaking]       = useState(() => new Set());
  const [done,          setDone]          = useState(false);

  // ── Layout tracking for SVG lines ────────────────────────────
  const [rowLayout,        setRowLayout]        = useState(null);
  const [causeColLayout,   setCauseColLayout]   = useState(null);
  const [effectColLayout,  setEffectColLayout]  = useState(null);
  const [causeBodyLayout,  setCauseBodyLayout]  = useState(null);
  const [effectBodyLayout, setEffectBodyLayout] = useState(null);
  const [causePosMap,  setCausePosMap]  = useState({});
  const [effectPosMap, setEffectPosMap] = useState({});

  // ── Interaction ───────────────────────────────────────────────
  function handleCauseTap(pairIdx) {
    if (done || locked.has(pairIdx)) return;
    Haptics.selectionAsync();
    setSelectedCause(prev => (prev === pairIdx ? null : pairIdx));
  }

  function handleEffectTap(pairIdx) {
    if (done || locked.has(pairIdx) || selectedCause === null) return;
    Haptics.selectionAsync();

    if (pairIdx === selectedCause) {
      const newLocked = new Set(locked);
      newLocked.add(pairIdx);
      setLocked(newLocked);
      setSelectedCause(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (newLocked.size === pairs.length) {
        setDone(true);
        // Lottie plays for 1800ms then advance
        setTimeout(() => onResolve(true), 1800);
      }
    } else {
      const wrongSet = new Set([selectedCause, pairIdx]);
      setShaking(wrongSet);
      setSelectedCause(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setShaking(new Set()), 800);
    }
  }

  const allDone   = locked.size === pairs.length;
  const hasSelect = selectedCause !== null;

  // ── SVG line endpoints ────────────────────────────────────────
  function getLineEndpoints(pairIdx) {
    const cp = causePosMap[pairIdx];
    const ep = effectPosMap[pairIdx];
    if (!causeColLayout || !effectColLayout || !causeBodyLayout || !effectBodyLayout || !cp || !ep) return null;
    return {
      x1: causeColLayout.x  + causeColLayout.width,
      y1: causeColLayout.y  + causeBodyLayout.y  + cp.y + cp.height / 2,
      x2: effectColLayout.x,
      y2: effectColLayout.y + effectBodyLayout.y + ep.y + ep.height / 2,
    };
  }

  function buildArrowPath(x1, y1, x2, y2) {
    const angle  = Math.atan2(y2 - y1, x2 - x1);
    const len    = 8;
    const spread = Math.PI / 5.5;
    const ax1 = x2 - len * Math.cos(angle - spread);
    const ay1 = y2 - len * Math.sin(angle - spread);
    const ax2 = x2 - len * Math.cos(angle + spread);
    const ay2 = y2 - len * Math.sin(angle + spread);
    return `M ${ax1.toFixed(1)},${ay1.toFixed(1)} L ${x2.toFixed(1)},${y2.toFixed(1)} L ${ax2.toFixed(1)},${ay2.toFixed(1)}`;
  }

  // ── Step hint ─────────────────────────────────────────────────
  let stepHint      = '① Tap a cause  →  ② tap its effect';
  let stepHintStyle = ceStyles.stepHint;
  if (allDone) {
    stepHint      = 'Every pair matched!';
    stepHintStyle = [ceStyles.stepHint, ceStyles.stepHintDone];
  } else if (hasSelect) {
    const raw   = pairs[selectedCause]?.cause ?? '';
    const short = raw.length > 24 ? raw.slice(0, 22) + '…' : raw;
    stepHint      = `② Now tap the effect for "${short}"`;
    stepHintStyle = [ceStyles.stepHint, ceStyles.stepHintActive];
  }

  return (
    <View style={ceStyles.root}>

      {/* Step hint */}
      <Text style={stepHintStyle}>{stepHint}</Text>

      {/* ── Columns row with SVG overlay ── */}
      <View
        style={ceStyles.columnsRow}
        onLayout={e => setRowLayout(e.nativeEvent.layout)}
      >
        {/* Cause column */}
        <View
          style={ceStyles.column}
          onLayout={e => setCauseColLayout(e.nativeEvent.layout)}
        >
          <PulseView active={!hasSelect && !allDone}>
            <View style={[ceStyles.columnHeader, { borderBottomColor: '#fb923c' }]}>
              <Text style={[ceStyles.columnLabel, { color: '#fb923c' }]}>⚡ Cause</Text>
              <Text style={[ceStyles.columnSub, { color: hasSelect ? '#fb923c44' : '#fb923ccc' }]}>
                {hasSelect ? 'selected ✓' : '① tap one'}
              </Text>
            </View>
          </PulseView>
          <View
            style={ceStyles.columnBody}
            onLayout={e => setCauseBodyLayout(e.nativeEvent.layout)}
          >
            {causeOrder.map(pairIdx => {
              const isLocked   = locked.has(pairIdx);
              const isSelected = selectedCause === pairIdx && !isLocked;
              const pc         = isLocked ? pairColor(pairIdx) : null;
              return (
                <ShakeView
                  key={pairIdx}
                  isShaking={shaking.has(pairIdx)}
                  onLayout={e => {
                    const { y, height } = e.nativeEvent.layout;
                    setCausePosMap(prev => ({ ...prev, [pairIdx]: { y, height } }));
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleCauseTap(pairIdx)}
                    activeOpacity={0.75}
                    disabled={done || isLocked}
                  >
                    <EmojiChip
                      text={pairs[pairIdx].cause}
                      emoji={pairs[pairIdx].causeEmoji}
                      isLocked={isLocked}
                      checkColor={pc?.text}
                      chipStyle={[
                        isLocked   && { backgroundColor: pc.bg, borderColor: pc.border },
                        isSelected && ceStyles.chipSelected,
                      ]}
                      textStyle={[
                        isLocked   && { color: pc.text },
                        isSelected && { color: '#f1f5f9', fontWeight: '700' },
                      ]}
                    />
                  </TouchableOpacity>
                </ShakeView>
              );
            })}
          </View>
        </View>

        {/* Effect column */}
        <View
          style={ceStyles.column}
          onLayout={e => setEffectColLayout(e.nativeEvent.layout)}
        >
          <PulseView active={hasSelect && !allDone}>
            <View style={[ceStyles.columnHeader, { borderBottomColor: '#60a5fa' }]}>
              <Text style={[ceStyles.columnLabel, { color: '#60a5fa' }]}>💥 Effect</Text>
              <Text style={[ceStyles.columnSub, { color: hasSelect ? '#60a5facc' : '#60a5fa44' }]}>
                {hasSelect ? '② tap the match' : 'tap cause first'}
              </Text>
            </View>
          </PulseView>
          <View
            style={ceStyles.columnBody}
            onLayout={e => setEffectBodyLayout(e.nativeEvent.layout)}
          >
            {effectOrder.map(pairIdx => {
              const isLocked = locked.has(pairIdx);
              const canTap   = hasSelect && !isLocked;
              const pc       = isLocked ? pairColor(pairIdx) : null;
              return (
                <ShakeView
                  key={pairIdx}
                  isShaking={shaking.has(pairIdx)}
                  onLayout={e => {
                    const { y, height } = e.nativeEvent.layout;
                    setEffectPosMap(prev => ({ ...prev, [pairIdx]: { y, height } }));
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleEffectTap(pairIdx)}
                    activeOpacity={0.75}
                    disabled={done || isLocked || !hasSelect}
                  >
                    <EmojiChip
                      text={pairs[pairIdx].effect}
                      emoji={pairs[pairIdx].effectEmoji}
                      isLocked={isLocked}
                      checkColor={pc?.text}
                      chipStyle={[
                        isLocked && { backgroundColor: pc.bg, borderColor: pc.border },
                        canTap   && ceStyles.chipTappable,
                      ]}
                      textStyle={[
                        isLocked && { color: pc.text },
                        canTap   && { color: '#f1f5f9' },
                      ]}
                    />
                  </TouchableOpacity>
                </ShakeView>
              );
            })}
          </View>
        </View>

        {/* SVG connector lines — wrapped in View with pointerEvents so native
            touch system ignores the overlay on iOS/Android */}
        {rowLayout && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Svg width={rowLayout.width} height={rowLayout.height}>
              {[...locked].map(pairIdx => {
                const pts = getLineEndpoints(pairIdx);
                if (!pts) return null;
                const { x1, y1, x2, y2 } = pts;
                const pc = pairColor(pairIdx);
                return (
                  <React.Fragment key={pairIdx}>
                    <Line
                      x1={x1.toFixed(1)} y1={y1.toFixed(1)}
                      x2={x2.toFixed(1)} y2={y2.toFixed(1)}
                      stroke={pc.border}
                      strokeWidth="2"
                      strokeDasharray="5,4"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                    <Path
                      d={buildArrowPath(x1, y1, x2, y2)}
                      stroke={pc.border}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity="0.85"
                    />
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
        )}
      </View>

      {/* ── Success state — Lottie + banner ── */}
      {allDone && (
        <View style={ceStyles.successArea}>
          <LottieView
            source={SUCCESS_LOTTIE}
            autoPlay
            loop={false}
            style={ceStyles.lottieAnim}
          />
          <Text style={ceStyles.successText}>Every cause matched its effect! 🎉</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const ceStyles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingBottom: 8,
    width: '100%',
  },
  stepHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16,
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    alignSelf: 'center',
  },
  stepHintActive: {
    color: '#e2e8f0',
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  stepHintDone: {
    color: '#4ade80',
    borderColor: '#4ade80',
    backgroundColor: 'rgba(74,222,128,0.1)',
  },

  columnsRow: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
    marginBottom: 14,
  },
  column: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  columnHeader: {
    paddingVertical: 9,
    paddingHorizontal: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderBottomWidth: 2.5,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  columnSub: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  columnBody: {
    padding: 5,
    gap: 4,
  },

  // Chips
  chip: {
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  chipSelected: {
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.14)',
  },
  // Neutral "ready to tap" — deliberately not a pair color so it won't be confused
  // with any locked pair highlight
  chipTappable: {
    borderColor: '#94a3b8',
    backgroundColor: 'rgba(148,163,184,0.1)',
  },
  chipText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  checkMark: {
    fontSize: 11,
    fontWeight: '900',
  },

  // Emoji
  emojiWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    flexShrink: 0,
  },
  emojiText: {
    fontSize: 18,
    lineHeight: 22,
  },

  // Success
  successArea: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  lottieAnim: {
    width: 140,
    height: 140,
  },
  successText: {
    color: '#4ade80',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
    marginTop: -8,
  },
});
