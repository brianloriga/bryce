import React, { useState, useRef, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TextInput, TouchableOpacity,
  Animated, PanResponder, Image, Keyboard, StyleSheet,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { measStyles, SLIDER_W } from '../shared/measurementStyles';

// ── Avatar map (shared with ProtractorRenderer) ───────────────
const AVATAR_MAP = {
  nina: require('../../../assets/child-avatars/nina_avatar.png'),
  sam:  require('../../../assets/child-avatars/sam_avatar.png'),
  mia:  require('../../../assets/child-avatars/mia_avatar.png'),
  leo:  require('../../../assets/child-avatars/leo_avatar.png'),
  ava:  require('../../../assets/child-avatars/ava_avatar.png'),
  max:  require('../../../assets/child-avatars/max_avatar.png'),
};

// ── Clock face constants ──────────────────────────────────────
const CLOCK_SIZE    = 250;
const CX            = CLOCK_SIZE / 2;
const CY            = CLOCK_SIZE / 2;
const CLOCK_R       = 114;
const HOUR_LABEL_R  = 86;
const HOUR_HAND_LEN = 60;
const MIN_HAND_LEN  = 88;

// ── Time helpers ──────────────────────────────────────────────
// Clock angle: 0° = 12 o'clock, increases clockwise.
// armStyle angle: 0° = right, 90° = up, counterclockwise.
function clockToArm(clockDeg) { return 90 - clockDeg; }

function hourAngleDeg(h, m) { return ((h % 12) + m / 60) * 30; }
function minAngleDeg(m)     { return m * 6; }

function formatTime(h, m) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}`;
}

// ── Auto-colon number-pad helpers ────────────────────────────
// Kids type only digits on the number-pad; the colon appears automatically.
// Raw = string of digit chars only (max 4).
//
// Hour resolution rules:
//   First digit 2-9  → single-digit hour, colon after 1st digit  (max 3 raw)
//   First digit 1, second digit 0/1/2 → two-digit hour 10/11/12 (max 4 raw)
//   First digit 1, second digit 3-9   → hour is 1               (max 3 raw)

function formatRawDigits(raw) {
  if (!raw || raw.length === 0) return '';
  const d = raw;
  const d0 = parseInt(d[0], 10);
  if (d0 === 0) return '';

  if (d.length === 1) {
    return d0 >= 2 ? `${d0}:` : d0.toString();
  }
  const d1 = parseInt(d[1], 10);
  if (d.length === 2) {
    if (d0 >= 2)        return `${d0}:${d1}`;
    if (d1 <= 2)        return `1${d1}:`;          // hour 10/11/12
    return `1:${d1}`;                               // hour 1, first minute digit
  }
  const d2 = parseInt(d[2], 10);
  if (d.length === 3) {
    if (d0 >= 2)        return `${d0}:${d1}${d2}`;
    if (d1 <= 2)        return `1${d1}:${d2}`;
    return `1:${d1}${d2}`;
  }
  // 4 digits — only valid when two-digit hour (10/11/12)
  if (d.length >= 4 && d0 === 1 && parseInt(d[1], 10) <= 2) {
    return `1${d[1]}:${d[2]}${d[3]}`;
  }
  return formatRawDigits(d.slice(0, 3));
}

function maxRawLen(raw) {
  if (!raw || raw.length === 0) return 4;
  const d0 = parseInt(raw[0], 10);
  if (d0 >= 2) return 3;
  if (raw.length === 1) return 4;
  return parseInt(raw[1], 10) <= 2 ? 4 : 3;
}

// Parse rawDigits to "H:MM" for validation, or null if incomplete.
function rawToNormalised(raw) {
  const display = formatRawDigits(raw);
  const match   = display.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Build 4 MC estimate options centered on the actual time.
// Options are on 15-minute boundaries; the correct one is the closest.
function buildEstimateOptions(hours, minutes) {
  const h12    = hours % 12 === 0 ? 12 : hours % 12;
  const total  = h12 * 60 + minutes;

  // Candidate anchors every 15 minutes around the actual time
  const anchors = [-45, -30, -15, 0, 15, 30, 45].map(d => {
    let t = total + d;
    while (t < 0)   t += 12 * 60;
    while (t >= 12 * 60) t -= 12 * 60;
    const ah = t === 0 ? 12 : Math.floor(t / 60) === 0 ? 12 : Math.floor(t / 60);
    const am = t % 60;
    return { label: formatTime(ah, am), diff: Math.abs(d) };
  });

  // Remove duplicates and sort by closeness
  const seen  = new Set();
  const unique = anchors.filter(a => {
    if (seen.has(a.label)) return false;
    seen.add(a.label);
    return true;
  }).sort((a, b) => a.diff - b.diff);

  const correct = unique[0].label;
  // Pick 3 distractors from next closest
  const distractors = unique.slice(1, 4).map(a => a.label);
  while (distractors.length < 3) {
    // Fill gap with fallback offsets if we somehow run out
    const extra = anchors.find(a => !seen.has(a.label + 'x'));
    distractors.push(extra?.label ?? '12:00');
  }

  // Shuffle all 4 options
  const all = [correct, ...distractors];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return { options: all, correct };
}

// Diagnostic feedback for SetMode wrong answers
function setDiagnostic(targetH, targetM, currentH, currentM) {
  const hOk = currentH % 12 === targetH % 12;
  const mOk = currentM === targetM;
  if (hOk && !mOk) return `The hour hand looks right! Move the minute hand to the ${targetM === 0 ? '12' : targetM / 5} mark.`;
  if (!hOk && mOk) return `The minutes are correct! The hour hand should point toward ${targetH % 12 === 0 ? 12 : targetH % 12}.`;
  return `The time should be ${formatTime(targetH, targetM)}. Check both hands.`;
}

// ── ClockFace — SVG implementation ────────────────────────────
// Clock convention: 0° = 12 o'clock, increases clockwise.
// SVG helpers use sin/cos with this convention directly (y-down coords).
function ClockFace({ hours, minutes, hourDeg, minuteDeg }) {
  const hDeg = hourDeg   ?? hourAngleDeg(hours, minutes);
  const mDeg = minuteDeg ?? minAngleDeg(minutes);

  // Point on clock circle at clock-degree cdeg (0 = top, CW)
  function ptc(r, cdeg) {
    const rad = (cdeg * Math.PI) / 180;
    return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
  }

  return (
    <Svg
      width={CLOCK_SIZE} height={CLOCK_SIZE}
      style={{ alignSelf: 'center', marginVertical: 12 }}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="faceGrad" cx="50%" cy="40%" rx="55%" ry="55%">
          <Stop offset="0"   stopColor="#1e293b" stopOpacity="1" />
          <Stop offset="1"   stopColor="#0a1220" stopOpacity="1" />
        </RadialGradient>
      </Defs>

      {/* ── Face ── */}
      <Circle cx={CX} cy={CY} r={CLOCK_R}     fill="url(#faceGrad)" />
      <Circle cx={CX} cy={CY} r={CLOCK_R}     fill="none" stroke="#334155" strokeWidth="2" />
      <Circle cx={CX} cy={CY} r={CLOCK_R - 8} fill="none" stroke="#1e293b" strokeWidth="1" />

      {/* ── 60 tick marks ── */}
      {Array.from({ length: 60 }, (_, i) => {
        const cdeg    = i * 6;
        const is5min  = i % 5 === 0;
        const is15min = i % 15 === 0;
        const tickLen = is15min ? 14 : is5min ? 9 : 5;
        const outer   = ptc(CLOCK_R - 2, cdeg);
        const inner   = ptc(CLOCK_R - 2 - tickLen, cdeg);
        return (
          <Line
            key={i}
            x1={outer.x.toFixed(2)} y1={outer.y.toFixed(2)}
            x2={inner.x.toFixed(2)} y2={inner.y.toFixed(2)}
            stroke={is15min ? '#64748b' : is5min ? '#475569' : '#2d3748'}
            strokeWidth={is15min ? 2.5 : is5min ? 1.5 : 1}
            strokeLinecap="round"
          />
        );
      })}

      {/* ── Hour numbers 1–12 ── */}
      {Array.from({ length: 12 }, (_, i) => {
        const num    = i + 1;
        const { x, y } = ptc(HOUR_LABEL_R, num * 30);
        return (
          <SvgText
            key={num}
            x={x.toFixed(2)} y={(y + 5).toFixed(2)}
            textAnchor="middle"
            fontSize="15" fontWeight="bold" fill="#e2e8f0"
          >
            {num}
          </SvgText>
        );
      })}

      {/* ── Minute hand (green, thin, with tail stub) ── */}
      {(() => {
        const tail = ptc(-16, mDeg);
        const tip  = ptc(MIN_HAND_LEN, mDeg);
        return (
          <Line
            x1={tail.x.toFixed(2)} y1={tail.y.toFixed(2)}
            x2={tip.x.toFixed(2)}  y2={tip.y.toFixed(2)}
            stroke="#4ade80" strokeWidth="3" strokeLinecap="round"
          />
        );
      })()}

      {/* ── Hour hand (purple, wide, with tail stub) ── */}
      {(() => {
        const tail = ptc(-12, hDeg);
        const tip  = ptc(HOUR_HAND_LEN, hDeg);
        return (
          <Line
            x1={tail.x.toFixed(2)} y1={tail.y.toFixed(2)}
            x2={tip.x.toFixed(2)}  y2={tip.y.toFixed(2)}
            stroke="#7c3aed" strokeWidth="6.5" strokeLinecap="round"
          />
        );
      })()}

      {/* ── Centre cap ── */}
      <Circle cx={CX} cy={CY} r="8"   fill="#94a3b8" />
      <Circle cx={CX} cy={CY} r="4.5" fill="#0f172a" />
    </Svg>
  );
}

// ── Shared slider hook (same stale-closure-safe pattern as Protractor) ──
function useClockSlider({ steps, initialStep, onStep }) {
  const stepPx      = SLIDER_W / (steps - 1);
  const stepRef     = useRef(initialStep);
  const startXRef   = useRef(initialStep * stepPx);
  const lockedRef   = useRef(false);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder:       () => !lockedRef.current,
    onMoveShouldSetPanResponder:        () => !lockedRef.current,
    onMoveShouldSetPanResponderCapture: () => !lockedRef.current,
    onPanResponderTerminationRequest:   () => false,
    onPanResponderGrant: (e) => {
      if (lockedRef.current) return;
      const x  = Math.max(0, Math.min(SLIDER_W, e.nativeEvent.locationX));
      const s  = Math.round(x / stepPx);
      startXRef.current = s * stepPx;
      stepRef.current   = s;
      onStep(s);
    },
    onPanResponderMove: (_, gs) => {
      if (lockedRef.current) return;
      const nx = Math.max(0, Math.min(SLIDER_W, startXRef.current + gs.dx));
      const s  = Math.round(nx / stepPx);
      if (s !== stepRef.current) { stepRef.current = s; onStep(s); }
    },
  })).current;

  return { panResponder, lock: () => { lockedRef.current = true; } };
}

// ── ReadMode ──────────────────────────────────────────────────
function ReadMode({ q, onResolve }) {
  const geo     = q.geometry ?? {};
  const hours   = Number(geo.hours   ?? 3);
  const minutes = Number(geo.minutes ?? 0);
  const correct = String(q.correctAnswer ?? formatTime(hours, minutes)).toLowerCase().trim();

  // rawDigits: only the digit chars the kid has typed (max 4)
  const [rawDigits, setRawDigits] = useState('');
  const [feedback,  setFeedback]  = useState(null); // null | 'correct' | 'wrong'
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Keep a ref to the current formatted string so the onChange handler can
  // detect backspace vs. new digit without closure-staleness issues.
  const formattedRef = useRef('');
  formattedRef.current = formatRawDigits(rawDigits);

  function doShake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleChange(newText) {
    if (feedback) return;
    // Detect backspace: displayed string got shorter
    if (newText.length < formattedRef.current.length) {
      setRawDigits(prev => prev.slice(0, -1));
      return;
    }
    // Extract new digit(s) appended
    const newDigits = newText.replace(/\D/g, '');
    setRawDigits(prev => {
      const combined = prev + newDigits.slice(prev.length);
      return combined.slice(0, maxRawLen(combined));
    });
  }

  function handleSubmit() {
    if (feedback) return;
    Keyboard.dismiss();
    const norm = rawToNormalised(rawDigits);
    if (!norm) { doShake(); return; }

    const accepted = [
      correct,
      ...(Array.isArray(q.acceptedAnswers)
        ? q.acceptedAnswers.map(a => String(a).toLowerCase().trim())
        : []),
    ];
    const isCorrect = accepted.includes(norm.toLowerCase());

    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      doShake();
    }
    setTimeout(() => onResolve(isCorrect), isCorrect ? 900 : 1600);
  }

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';
  const display   = formattedRef.current;

  return (
    <View style={clockStyles.modeWrap}>
      <ClockFace hours={hours} minutes={minutes} />

      <Text style={clockStyles.instruction}>What time does the clock show?</Text>

      <Animated.View style={[clockStyles.inputRow, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={[
          clockStyles.inputWrap,
          isCorrect && clockStyles.inputCorrect,
          isWrong   && clockStyles.inputWrong,
        ]}>
          <TextInput
            style={clockStyles.timeInput}
            placeholder="H:MM"
            placeholderTextColor="#475569"
            value={display}
            onChangeText={handleChange}
            keyboardType="number-pad"
            autoCorrect={false}
            editable={!feedback}
            onSubmitEditing={handleSubmit}
          />
        </View>
      </Animated.View>

      {isWrong && (
        <Text style={clockStyles.revealText}>
          The time shown is <Text style={{ color: '#4ade80', fontWeight: '900' }}>{formatTime(hours, minutes)}</Text>
        </Text>
      )}
      {isCorrect && (
        <Text style={clockStyles.correctMsg}>✓ Great reading!</Text>
      )}

      {!feedback && (
        <TouchableOpacity style={clockStyles.submitBtn} onPress={handleSubmit}>
          <Text style={clockStyles.submitBtnText}>Check</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── SetMode ───────────────────────────────────────────────────
function SetMode({ q, onResolve, setScrollEnabled }) {
  const geo     = q.geometry ?? {};
  const targetH = Number(geo.hours   ?? 3);
  const targetM = Number(geo.minutes ?? 0);

  // Hour slider: steps 0–11 map to hours 1–12
  const [hourStep,   setHourStep]   = useState(0);
  const [minuteStep, setMinuteStep] = useState(0);
  const [feedback,   setFeedback]   = useState(null);

  const currentH = hourStep + 1;          // 1–12
  const currentM = minuteStep * 5;        // 0, 5, 10 … 55

  const hourSlider = useClockSlider({
    steps: 12, initialStep: 0,
    onStep: (s) => { if (!feedback) setHourStep(s); },
  });
  const minSlider = useClockSlider({
    steps: 12, initialStep: 0,
    onStep: (s) => { if (!feedback) setMinuteStep(s); },
  });

  const hourFill   = (hourStep   / 11) * SLIDER_W;
  const minuteFill = (minuteStep / 11) * SLIDER_W;

  function handleCheck() {
    if (feedback) return;
    hourSlider.lock(); minSlider.lock();
    const hOk = currentH % 12 === targetH % 12;
    const mOk = currentM === targetM;
    const ok  = hOk && mOk;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  function handleReset() {
    setHourStep(0); setMinuteStep(0);
  }

  const targetDisplay = formatTime(targetH, targetM);

  return (
    <View style={clockStyles.modeWrap}>
      {/* Target time badge */}
      <View style={clockStyles.targetBadge}>
        <Text style={clockStyles.targetLabel}>Show this time:</Text>
        <Text style={clockStyles.targetTime}>{targetDisplay}</Text>
      </View>

      <ClockFace
        hours={currentH}
        minutes={currentM}
        hourDeg={hourAngleDeg(currentH, currentM)}
        minuteDeg={minAngleDeg(currentM)}
      />

      {/* Hour slider */}
      <View style={clockStyles.sliderSection}>
        <View style={clockStyles.sliderLabelRow}>
          <View style={[clockStyles.handDot, { backgroundColor: '#7c3aed' }]} />
          <Text style={clockStyles.sliderHandLabel}>HOUR HAND</Text>
          <Text style={clockStyles.sliderValue}>{currentH}</Text>
        </View>
        <View style={measStyles.sliderRow}>
          <Text style={measStyles.sliderEndLabel}>1</Text>
          <View style={measStyles.sliderTrack} {...hourSlider.panResponder.panHandlers}>
            <View style={[measStyles.sliderFill, { width: hourFill, backgroundColor: '#7c3aed' }]} />
            <View style={[measStyles.sliderHandle, { left: hourFill - 12, backgroundColor: '#7c3aed', borderColor: '#a78bfa' }]} />
          </View>
          <Text style={measStyles.sliderEndLabel}>12</Text>
        </View>
      </View>

      {/* Minute slider */}
      <View style={clockStyles.sliderSection}>
        <View style={clockStyles.sliderLabelRow}>
          <View style={[clockStyles.handDot, { backgroundColor: '#4ade80' }]} />
          <Text style={clockStyles.sliderHandLabel}>MINUTE HAND</Text>
          <Text style={clockStyles.sliderValue}>{String(currentM).padStart(2, '0')}</Text>
        </View>
        <View style={measStyles.sliderRow}>
          <Text style={measStyles.sliderEndLabel}>:00</Text>
          <View style={measStyles.sliderTrack} {...minSlider.panResponder.panHandlers}>
            <View style={[measStyles.sliderFill, { width: minuteFill, backgroundColor: '#4ade80' }]} />
            <View style={[measStyles.sliderHandle, { left: minuteFill - 12, backgroundColor: '#4ade80', borderColor: '#86efac' }]} />
          </View>
          <Text style={measStyles.sliderEndLabel}>:55</Text>
        </View>
      </View>

      {feedback === 'wrong' && (
        <View style={clockStyles.diagnosticBanner}>
          <Text style={clockStyles.diagnosticText}>
            {setDiagnostic(targetH, targetM, currentH, currentM)}
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <Text style={clockStyles.correctMsg}>✓ Perfect! The clock shows {targetDisplay}.</Text>
      )}

      {!feedback && (
        <View style={clockStyles.actionRow}>
          <TouchableOpacity style={clockStyles.resetBtn} onPress={handleReset}>
            <Text style={clockStyles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={clockStyles.submitBtn} onPress={handleCheck}>
            <Text style={clockStyles.submitBtnText}>Check</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── EstimateMode ──────────────────────────────────────────────
function EstimateMode({ q, onResolve }) {
  const geo     = q.geometry ?? {};
  const hours   = Number(geo.hours   ?? 8);
  const minutes = Number(geo.minutes ?? 47);

  // Memoised so the shuffle never re-runs on re-render (state changes would
  // otherwise re-shuffle the options mid-answer).
  const { options, correct } = useMemo(
    () => buildEstimateOptions(hours, minutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(opt) {
    if (feedback) return;
    setChosen(opt);
    const ok = opt === correct;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => onResolve(ok), ok ? 900 : 1600);
  }

  return (
    <View style={clockStyles.modeWrap}>
      <ClockFace hours={hours} minutes={minutes} />
      <Text style={clockStyles.instruction}>About what time is shown?</Text>

      <View style={measStyles.estimateGrid}>
        {options.map((opt) => {
          const isChosen  = chosen === opt;
          const isCorrect = feedback && opt === correct;
          const isWrong   = feedback && isChosen && opt !== correct;
          const isDimmed  = feedback && !isChosen && opt !== correct;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                measStyles.estimateBtn,
                isChosen  && measStyles.estimateBtnChosen,
                isCorrect && measStyles.estimateBtnCorrect,
                isWrong   && measStyles.estimateBtnWrong,
                isDimmed  && measStyles.estimateBtnDimmed,
              ]}
              onPress={() => handlePick(opt)}
              disabled={!!feedback}
            >
              <Text style={measStyles.estimateBtnText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedback === 'wrong' && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>
            The minute hand points near {minutes}m past the hour. The closest option is {correct}.
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            Nice estimation! The clock shows close to {correct}. 🕐
          </Text>
        </View>
      )}
    </View>
  );
}

// ── SpotMistakeMode ───────────────────────────────────────────
function SpotMistakeMode({ q, onResolve }) {
  const geo     = q.geometry ?? {};
  const hours   = Number(geo.hours   ?? 6);
  const minutes = Number(geo.minutes ?? 15);

  const claimA       = geo.claimA       ?? { name: 'Nina', time: formatTime(hours, minutes) };
  const claimB       = geo.claimB       ?? { name: 'Sam',  time: formatTime(hours, (minutes + 30) % 60) };
  const correctClaim = geo.correctClaim ?? 'A';
  const neitherIsCorrect = correctClaim === 'neither';

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(claim) {
    if (feedback) return;
    setChosen(claim);
    const ok = claim === correctClaim;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  const winnerName = correctClaim === 'A' ? claimA.name
    : correctClaim === 'B' ? claimB.name
    : null;

  const isClaimACorrect = feedback && correctClaim === 'A';
  const isClaimAWrong   = feedback && chosen === 'A' && correctClaim !== 'A';
  const isClaimBCorrect = feedback && correctClaim === 'B';
  const isClaimBWrong   = feedback && chosen === 'B' && correctClaim !== 'B';
  const isNeitherCorrect= feedback && neitherIsCorrect;
  const isNeitherWrong  = feedback && chosen === 'neither' && !neitherIsCorrect;

  return (
    <View style={clockStyles.modeWrap}>
      <ClockFace hours={hours} minutes={minutes} />

      <View style={measStyles.claimRow}>
        {/* Claim A */}
        <TouchableOpacity
          style={[
            measStyles.claimBtn,
            isClaimACorrect && measStyles.claimBtnCorrect,
            isClaimAWrong   && measStyles.claimBtnWrong,
            feedback && chosen !== 'A' && correctClaim !== 'A' && measStyles.claimBtnDimmed,
          ]}
          onPress={() => handlePick('A')}
          disabled={!!feedback}
        >
          <Image
            source={AVATAR_MAP[claimA.name?.toLowerCase()] ?? AVATAR_MAP.nina}
            style={measStyles.claimAvatar}
          />
          <Text style={measStyles.claimName}>{claimA.name}</Text>
          <Text style={measStyles.claimValue}>{claimA.time}</Text>
        </TouchableOpacity>

        {/* Claim B */}
        <TouchableOpacity
          style={[
            measStyles.claimBtn,
            isClaimBCorrect && measStyles.claimBtnCorrect,
            isClaimBWrong   && measStyles.claimBtnWrong,
            feedback && chosen !== 'B' && correctClaim !== 'B' && measStyles.claimBtnDimmed,
          ]}
          onPress={() => handlePick('B')}
          disabled={!!feedback}
        >
          <Image
            source={AVATAR_MAP[claimB.name?.toLowerCase()] ?? AVATAR_MAP.sam}
            style={measStyles.claimAvatar}
          />
          <Text style={measStyles.claimName}>{claimB.name}</Text>
          <Text style={measStyles.claimValue}>{claimB.time}</Text>
        </TouchableOpacity>
      </View>

      {/* "They are both wrong" button */}
      <TouchableOpacity
        style={[
          measStyles.neitherBtn,
          isNeitherCorrect && measStyles.neitherBtnCorrect,
          isNeitherWrong   && measStyles.neitherBtnWrong,
        ]}
        onPress={() => handlePick('neither')}
        disabled={!!feedback}
      >
        <Text style={measStyles.neitherBtnText}>They are both wrong</Text>
      </TouchableOpacity>

      {feedback && (
        <View style={measStyles.spotExplanation}>
          <Text style={measStyles.spotExplanationText}>
            {winnerName
              ? `${winnerName} is correct! The clock shows ${formatTime(hours, minutes)}.`
              : `Actually, neither is correct — the clock shows ${formatTime(hours, minutes)}.`}
            {' '}The minute hand points to the {minutes === 0 ? '12' : Math.floor(minutes / 5)} and the hour hand points toward {hours % 12 === 0 ? 12 : hours % 12}.
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Main ClockRenderer ────────────────────────────────────────
export default function ClockRenderer({ q, onResolve, setScrollEnabled }) {
  const mode = q.geometry?.clockMode ?? 'read';

  if (mode === 'set')          return <SetMode          q={q} onResolve={onResolve} setScrollEnabled={setScrollEnabled} />;
  if (mode === 'estimate')     return <EstimateMode      q={q} onResolve={onResolve} />;
  if (mode === 'spot_mistake') return <SpotMistakeMode   q={q} onResolve={onResolve} />;
  return                              <ReadMode           q={q} onResolve={onResolve} />;
}

// ── Clock-specific styles ─────────────────────────────────────
const clockStyles = StyleSheet.create({
  modeWrap: {
    alignItems: 'center', paddingBottom: 8,
  },
  centerDot: {
    position: 'absolute',
    left: CX - 5, top: CY - 5,
    width: 10, height: 10,
    borderRadius: 5, backgroundColor: '#f1f5f9',
  },
  instruction: {
    fontSize: 14, fontWeight: '600', color: '#94a3b8',
    textAlign: 'center', marginBottom: 8,
  },
  inputRow: {
    alignItems: 'center', marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 2, borderColor: '#334155',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  inputCorrect: { borderColor: '#22c55e', backgroundColor: '#14532d' },
  inputWrong:   { borderColor: '#ef4444', backgroundColor: '#7f1d1d' },
  timeInput: {
    fontSize: 36, fontWeight: '900', color: '#e2e8f0',
    minWidth: 90, textAlign: 'center',
  },
  revealText: {
    fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 6,
  },
  correctMsg: {
    fontSize: 15, fontWeight: '700', color: '#4ade80',
    textAlign: 'center', marginTop: 6,
  },
  submitBtn: {
    marginTop: 14, backgroundColor: '#7c3aed',
    paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 12, alignItems: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Set mode
  targetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#4ade80',
    paddingVertical: 8, paddingHorizontal: 20,
    marginBottom: 4,
  },
  targetLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  targetTime:  { fontSize: 32, fontWeight: '900', color: '#4ade80' },
  sliderSection: {
    width: SLIDER_W + 80, marginBottom: 4,
  },
  sliderLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 2, paddingHorizontal: 4,
  },
  handDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  sliderHandLabel: {
    flex: 1, fontSize: 10, fontWeight: '800',
    color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase',
  },
  sliderValue: {
    fontSize: 14, fontWeight: '900', color: '#e2e8f0', minWidth: 28, textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row', gap: 12, marginTop: 14,
  },
  resetBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 2, borderColor: '#334155', alignItems: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  diagnosticBanner: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
    padding: 12, marginTop: 8,
    width: SLIDER_W + 60,
  },
  diagnosticText: {
    fontSize: 13, color: '#fde68a', lineHeight: 18, textAlign: 'center',
  },
});
