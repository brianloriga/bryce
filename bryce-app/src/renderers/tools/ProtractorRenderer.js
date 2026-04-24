import React, { useState, useRef, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TextInput, TouchableOpacity,
  Animated, PanResponder, Image, Keyboard,
} from 'react-native';
import { armStyle, AngleStimulus } from '../shared/measurementHelpers';
import {
  measStyles, PROT_R, PROT_CX, PROT_CY, SLIDER_W,
} from '../shared/measurementStyles';

// ── Avatar map for Spot the Mistake ──────────────────────────────────────────
const AVATAR_MAP = {
  nina: require('../../../assets/child-avatars/nina_avatar.png'),
  sam:  require('../../../assets/child-avatars/sam_avatar.png'),
  mia:  require('../../../assets/child-avatars/mia_avatar.png'),
  leo:  require('../../../assets/child-avatars/leo_avatar.png'),
  ava:  require('../../../assets/child-avatars/ava_avatar.png'),
  max:  require('../../../assets/child-avatars/max_avatar.png'),
};

const PROT_LABEL_MARKS = [0, 30, 45, 60, 90, 120, 135, 150, 180];
const PROT_TICK_STEP   = 10;

// Returns the 4 closest multiples of 30 (from [30,60,90,120,150]) to angleDeg,
// sorted ascending. Used by EstimateMode.
function buildEstimateOptions(angleDeg) {
  const ALL     = [30, 60, 90, 120, 150];
  const correct = ALL.reduce((b, v) => Math.abs(v - angleDeg) < Math.abs(b - angleDeg) ? v : b);
  const sorted  = [...ALL].sort((a, b) => Math.abs(a - angleDeg) - Math.abs(b - angleDeg));
  return { options: sorted.slice(0, 4).sort((a, b) => a - b), correct };
}

// Returns the 3 closest multiples of 30 to angleDeg, sorted ascending.
// Used by AlignMode step 1 (3-button row).
function buildAlignEstimateOptions(angleDeg) {
  const ALL    = [30, 60, 90, 120, 150];
  const sorted = [...ALL].sort((a, b) => Math.abs(a - angleDeg) - Math.abs(b - angleDeg));
  return sorted.slice(0, 3).sort((a, b) => a - b);
}

function protractorDiagnostic(typed, correct, geo) {
  if (isNaN(typed)) return null;
  if (Math.abs(typed - (180 - correct)) <= 8) {
    const s    = geo?.scaleOrigin;
    const hint = s ? ` Start at the 0° on the ${s} side.` : '';
    return `You read from the wrong scale.${hint}`;
  }
  if (correct < 90 && typed > 90)  return 'This is an acute angle — it must be less than 90°.';
  if (correct > 90 && typed < 90)  return 'This is an obtuse angle — it must be greater than 90°.';
  if (correct === 90 && typed !== 90) return 'This is a right angle — it should be exactly 90°.';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// useShake — shared shake animation hook
// ─────────────────────────────────────────────────────────────────────────────
function useShake() {
  const anim = useRef(new Animated.Value(0)).current;
  function shake() {
    Animated.sequence([
      Animated.timing(anim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }
  return { anim, shake };
}

// ─────────────────────────────────────────────────────────────────────────────
// ProtractorFace — pure display component, no interaction logic.
// Renders the semicircle, tick marks, degree labels, arms, and ray labels.
// ─────────────────────────────────────────────────────────────────────────────
function ProtractorFace({
  refAngle,
  movableAngle,
  isFlipped     = false,
  showRefArm    = true,
  showMovable   = true,
  armColor      = '#7c3aed',
  geo,
  showReadout   = false,
  readoutText   = '',
}) {
  const baselineScreenDeg = isFlipped ? 180 : 0;
  const refArmScreenDeg   = isFlipped ? 180 - refAngle   : refAngle;
  const movableScreenDeg  = isFlipped ? 180 - movableAngle : movableAngle;
  const labelDist         = PROT_R + 32;
  const refArmRad         = (refArmScreenDeg   * Math.PI) / 180;
  const baselineRad       = (baselineScreenDeg * Math.PI) / 180;
  const refTipX = PROT_CX + labelDist * Math.cos(refArmRad);
  const refTipY = PROT_CY - labelDist * Math.sin(refArmRad);
  const r0TipX  = PROT_CX + labelDist * Math.cos(baselineRad);
  const r0TipY  = PROT_CY - labelDist * Math.sin(baselineRad);
  const labelVal = (mark) => isFlipped ? 180 - mark : mark;

  return (
    <View style={measStyles.protContainer}>
      {/* Semicircle arc */}
      <View style={[measStyles.protArc, { left: PROT_CX - PROT_R, top: PROT_CY - PROT_R }]} />
      {/* Baseline bar */}
      <View style={{ position: 'absolute', left: PROT_CX - PROT_R - 6, top: PROT_CY - 1, width: PROT_R * 2 + 12, height: 1.5, backgroundColor: '#475569' }} />

      {/* Minor tick marks */}
      {Array.from({ length: 19 }, (_, i) => i * PROT_TICK_STEP).map(deg => {
        if (PROT_LABEL_MARKS.includes(deg)) return null;
        const r  = (deg * Math.PI) / 180;
        const tx = PROT_CX + (PROT_R - 4) * Math.cos(r);
        const ty = PROT_CY - (PROT_R - 4) * Math.sin(r);
        return <View key={deg} style={armStyle(tx, ty, 8, deg, '#334155', 1.5)} />;
      })}

      {/* Reference arm + angle arc dots */}
      {showRefArm && <>
        <View style={armStyle(PROT_CX, PROT_CY, PROT_R + 18, refArmScreenDeg, '#e2e8f0', 1.5)} />
        {Array.from({ length: Math.round(refAngle / 3) }, (_, i) => {
          const t = Math.round(refAngle / 3) > 0 ? i / Math.round(refAngle / 3) : 0;
          const a = isFlipped ? baselineScreenDeg - t * refAngle : t * refAngle;
          const r = (a * Math.PI) / 180;
          return <View key={i} style={{ position: 'absolute', left: PROT_CX + 36 * Math.cos(r) - 1.5, top: PROT_CY - 36 * Math.sin(r) - 1.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#7c3aed', opacity: 0.5 }} />;
        })}
      </>}

      {/* Baseline arm */}
      <View style={armStyle(PROT_CX, PROT_CY, PROT_R - 6, baselineScreenDeg, '#475569')} />

      {/* Movable arm */}
      {showMovable && <View style={armStyle(PROT_CX, PROT_CY, PROT_R - 6, movableScreenDeg, armColor, 3)} />}

      {/* Center pivot dot */}
      <View style={{ position: 'absolute', left: PROT_CX - 5, top: PROT_CY - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#94a3b8' }} />

      {/* Degree labels at major marks */}
      {PROT_LABEL_MARKS.map(mark => {
        const rad  = (mark * Math.PI) / 180;
        const lx   = PROT_CX + (PROT_R + 18) * Math.cos(rad);
        const ly   = PROT_CY - (PROT_R + 18) * Math.sin(rad);
        const near = showMovable && Math.abs(labelVal(mark) - movableAngle) <= 6;
        return (
          <Text key={mark} style={[measStyles.protMarkLabel, { left: lx - 13, top: ly - 8 }, near && { color: armColor, fontWeight: '800' }]}>
            {labelVal(mark)}°
          </Text>
        );
      })}

      {/* Ray / vertex labels */}
      {geo && <>
        <Text style={[measStyles.protRayLabel, { left: PROT_CX - 8, top: PROT_CY + 10 }]}>{geo.vertex}</Text>
        <Text style={[measStyles.protRayLabel, { left: r0TipX - 6,  top: r0TipY - 9  }]}>{geo.ray1}</Text>
        {showRefArm && <Text style={[measStyles.protRayLabel, { left: refTipX - 6, top: refTipY - 9 }]}>{geo.ray2}</Text>}
      </>}

      {/* Angle readout overlay */}
      {showReadout && (
        <Text style={[measStyles.protReadout, { color: armColor }]}>{readoutText}</Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StepIndicator — "Step X of 3 — label text"
// ─────────────────────────────────────────────────────────────────────────────
function StepIndicator({ current, total, label }) {
  return (
    <View style={measStyles.stepBar}>
      <View style={measStyles.stepBadgeWrap}>
        <Text style={measStyles.stepBadge}>Step {current} of {total}</Text>
      </View>
      <Text style={measStyles.stepTitle}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SliderRow — angle drag slider, extracted for reuse across modes
// ─────────────────────────────────────────────────────────────────────────────
function SliderRow({ angleDeg, setAngleDeg, locked = false, setScrollEnabled }) {
  const sliderXRef = useRef((angleDeg / 180) * SLIDER_W);
  const startXRef  = useRef(sliderXRef.current);
  const lockedRef  = useRef(locked);
  lockedRef.current = locked;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => !lockedRef.current,
    onMoveShouldSetPanResponderCapture:  () => !lockedRef.current,
    onStartShouldSetPanResponder:        () => !lockedRef.current,
    onMoveShouldSetPanResponder:         () => !lockedRef.current,
    onPanResponderTerminationRequest:    () => false,
    onPanResponderGrant: (e) => {
      if (lockedRef.current) return;
      setScrollEnabled?.(false);
      const x = Math.max(0, Math.min(SLIDER_W, e.nativeEvent.locationX));
      sliderXRef.current = x; startXRef.current = x;
      setAngleDeg(Math.round((x / SLIDER_W) * 180));
    },
    onPanResponderMove: (_, gs) => {
      if (lockedRef.current) return;
      const nx = Math.max(0, Math.min(SLIDER_W, startXRef.current + gs.dx));
      sliderXRef.current = nx;
      setAngleDeg(Math.round((nx / SLIDER_W) * 180));
    },
    onPanResponderRelease:   () => setScrollEnabled?.(true),
    onPanResponderTerminate: () => setScrollEnabled?.(true),
  })).current;

  const sliderLeft = (angleDeg / 180) * SLIDER_W;

  return (
    <>
      <View style={[measStyles.sliderRow, locked && { opacity: 0.35 }]}>
        <Text style={measStyles.sliderEndLabel}>0°</Text>
        <View style={measStyles.sliderTrack} {...(!locked ? panResponder.panHandlers : {})}>
          <View style={[measStyles.sliderFill, { width: sliderLeft }]} />
          <View style={[measStyles.sliderHandle, { left: sliderLeft - 12 }]} pointerEvents="none" />
        </View>
        <Text style={measStyles.sliderEndLabel}>180°</Text>
      </View>
      <Text style={measStyles.sliderHint}>
        {locked ? 'Choose the scale above first' : 'Tap or drag anywhere on the bar'}
      </Text>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: Read + Build  (original behavior, now using shared ProtractorFace)
// ─────────────────────────────────────────────────────────────────────────────
function ReadBuildMode({ q, geo, mode, onResolve, styles, setScrollEnabled }) {
  const [angleDeg,    setAngleDeg]    = useState(90);
  const [feedback,    setFeedback]    = useState(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [scaleChosen, setScaleChosen] = useState(null);
  const [scaleError,  setScaleError]  = useState(null);
  const [wrongMsg,    setWrongMsg]    = useState(null);
  const { anim: shakeAnim, shake }    = useShake();
  const inputRef                      = useRef(null);

  const scaleOrigin  = geo?.scaleOrigin ?? null;
  const isFlipped    = geo?.flipped === true;
  const refAngle     = parseFloat(q.correctAnswer ?? '0');
  const sliderLocked = scaleOrigin != null && scaleChosen !== scaleOrigin;

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';
  const armColor  = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#7c3aed';

  const showRefArm      = mode !== 'build';
  const showSlider      = mode !== 'read';
  const needsTypedInput = mode !== 'build';

  function handleScaleChoice(choice) {
    if (feedback) return;
    if (choice === scaleOrigin) {
      setScaleChosen(choice); setScaleError(null);
    } else {
      const correct = scaleOrigin === 'right' ? 'right' : 'left';
      setScaleError(`Not quite — ${geo?.ray1 ?? 'the baseline ray'} lies along the ${correct} side, so start from the ${correct} 0°.`);
      shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function handleSubmit() {
    if (feedback) return;
    Keyboard.dismiss();
    const correct = parseFloat(q.correctAnswer ?? '0');
    if (mode === 'build') {
      const ok = Math.abs(angleDeg - correct) <= 5;
      setFeedback(ok ? 'correct' : 'wrong');
      ok ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
         : (shake(), Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      setTimeout(() => onResolve(ok), 1400);
      return;
    }
    const typed = parseFloat(typedAnswer.trim());
    if (isNaN(typed) || typedAnswer.trim() === '') {
      setScaleError('Enter the degree number before checking.'); return;
    }
    setScaleError(null);
    const ok   = Math.abs(typed - correct) <= 5;
    const diag = ok ? null : protractorDiagnostic(typed, correct, geo);
    setWrongMsg(diag);
    setFeedback(ok ? 'correct' : 'wrong');
    ok ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
       : (shake(), Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    setTimeout(() => onResolve(ok), 1800);
  }

  const showScaleStep = scaleOrigin != null && scaleChosen !== scaleOrigin;

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      {showScaleStep && (
        <View style={measStyles.scaleChoiceBox}>
          <Text style={measStyles.scaleChoicePrompt}>Which 0° do you start reading from?</Text>
          <View style={measStyles.scaleChoiceRow}>
            {['left', 'right'].map(side => (
              <TouchableOpacity
                key={side}
                style={[measStyles.scaleChoiceBtn, scaleChosen === side && measStyles.scaleChoiceBtnSelected]}
                onPress={() => handleScaleChoice(side)} activeOpacity={0.75}>
                <Text style={measStyles.scaleChoiceBtnText}>{side === 'left' ? '← Left side' : 'Right side →'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {scaleError && <Text style={measStyles.scaleChoiceError}>{scaleError}</Text>}
        </View>
      )}

      {scaleOrigin != null && scaleChosen === scaleOrigin && !feedback && (
        <View style={measStyles.scaleConfirmed}>
          <Text style={measStyles.scaleConfirmedText}>
            {mode === 'read'
              ? `✓ Reading from the ${scaleChosen} 0° — now read the angle and type your answer.`
              : mode === 'build'
              ? `✓ Reading from the ${scaleChosen} 0° — now drag the arm to build the angle.`
              : `✓ Reading from the ${scaleChosen} 0° — position the arm, then type the angle.`}
          </Text>
        </View>
      )}

      <View style={{ opacity: showScaleStep ? 0.35 : 1 }}>
        <ProtractorFace
          refAngle={refAngle}
          movableAngle={angleDeg}
          isFlipped={isFlipped}
          showRefArm={showRefArm}
          showMovable={showSlider}
          armColor={armColor}
          geo={geo}
          showReadout={!!feedback}
          readoutText={mode === 'build' ? `${angleDeg}°` : `${typedAnswer}°`}
        />
      </View>

      {mode === 'build' && !feedback && (
        <Text style={measStyles.buildModeLabel}>
          Create a {refAngle}° angle — drag the arm to the right position
        </Text>
      )}

      {showSlider && (
        <SliderRow
          angleDeg={angleDeg}
          setAngleDeg={setAngleDeg}
          locked={sliderLocked}
          setScrollEnabled={setScrollEnabled}
        />
      )}

      {needsTypedInput && !feedback && (
        <View style={measStyles.typedAnswerRow}>
          <Text style={measStyles.typedAnswerLabel}>
            {mode === 'read' ? 'What angle is shown?' : 'What angle do you measure?'}
          </Text>
          <View style={measStyles.typedAnswerInputWrap}>
            <TextInput
              ref={inputRef}
              style={measStyles.typedAnswerInput}
              keyboardType="numeric" returnKeyType="done" maxLength={3}
              value={typedAnswer}
              onChangeText={t => {
                setTypedAnswer(t.replace(/[^0-9]/g, ''));
                if (scaleError && t.trim() !== '') setScaleError(null);
              }}
              onSubmitEditing={handleSubmit}
              placeholder="___" placeholderTextColor="#475569"
              editable={!sliderLocked}
            />
            <Text style={measStyles.typedAnswerUnit}>°</Text>
          </View>
        </View>
      )}

      {scaleError && !showScaleStep && (
        <Text style={measStyles.scaleChoiceError}>{scaleError}</Text>
      )}

      {isWrong && (
        <View style={styles.fillInReveal}>
          {wrongMsg ? <Text style={[styles.fillInRevealLabel, { color: '#fbbf24', marginBottom: 4 }]}>{wrongMsg}</Text> : null}
          <Text style={styles.fillInRevealLabel}>Correct angle:</Text>
          <Text style={styles.fillInRevealAnswer}>{q.correctAnswer}°</Text>
        </View>
      )}
      {isCorrect && <Text style={styles.fillInCorrectMsg}>Correct! 📐</Text>}

      {!feedback && (
        <TouchableOpacity
          style={[styles.fillInSubmit, { marginTop: 20 }, sliderLocked && { opacity: 0.4 }]}
          onPress={handleSubmit} activeOpacity={0.8} disabled={sliderLocked}>
          <Text style={styles.fillInSubmitText}>
            {mode === 'build' ? 'Check Angle' : 'Submit'}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: Align  (3-step: Estimate → Align → Measure)
// Step 1 shows the angle stimulus only — no protractor — student estimates.
// Step 2 shows the full protractor with draggable arm.
// Step 3 shows a typed input; submitting this step scores the question.
// ─────────────────────────────────────────────────────────────────────────────
function AlignMode({ q, geo, onResolve, styles, setScrollEnabled }) {
  const correctAngle = parseFloat(q.correctAnswer ?? '0');
  const isFlipped    = geo?.flipped === true;

  const [step,           setStep]           = useState(1);
  const [estimateChoice, setEstimateChoice] = useState(null);
  const [movableAngle,   setMovableAngle]   = useState(90);
  const [typedAnswer,    setTypedAnswer]    = useState('');
  const [feedback,       setFeedback]       = useState(null);
  const [wrongMsg,       setWrongMsg]       = useState(null);
  const { anim: shakeAnim, shake }          = useShake();
  const inputRef                            = useRef(null);

  const estimateOpts = useMemo(() => buildAlignEstimateOptions(correctAngle), [correctAngle]);

  const STEP_LABELS = [
    'Estimate: How large is this angle?',
    `Align the protractor with ∠${geo?.vertex ?? 'B'}${geo?.ray1 ?? 'A'}${geo?.ray2 ?? 'C'}.`,
    'Type the measure.',
  ];

  function handleEstimate(val) {
    setEstimateChoice(val);
    setTimeout(() => setStep(2), 350);
  }

  function handleFinalSubmit() {
    if (feedback) return;
    Keyboard.dismiss();
    const typed = parseFloat(typedAnswer.trim());
    if (isNaN(typed) || typedAnswer.trim() === '') return;
    const ok   = Math.abs(typed - correctAngle) <= 5;
    const diag = ok ? null : protractorDiagnostic(typed, correctAngle, geo);
    setWrongMsg(diag);
    setFeedback(ok ? 'correct' : 'wrong');
    ok ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
       : (shake(), Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    setTimeout(() => onResolve(ok), 1800);
  }

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';
  const armColor  = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#7c3aed';

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <StepIndicator current={step} total={3} label={STEP_LABELS[step - 1]} />

      {/* ── Step 1: Estimate ── */}
      {step === 1 && (
        <>
          <AngleStimulus geometry={geo} />
          <View style={measStyles.estimateRow}>
            {estimateOpts.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[measStyles.estimatePill, estimateChoice === opt && measStyles.estimatePillChosen]}
                onPress={() => handleEstimate(opt)} activeOpacity={0.8}>
                <Text style={measStyles.estimatePillText}>{opt}°</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* ── Step 2: Align ── */}
      {step === 2 && (
        <>
          <ProtractorFace
            refAngle={correctAngle}
            movableAngle={movableAngle}
            isFlipped={isFlipped}
            showRefArm
            showMovable
            armColor={armColor}
            geo={geo}
          />
          <SliderRow
            angleDeg={movableAngle}
            setAngleDeg={setMovableAngle}
            setScrollEnabled={setScrollEnabled}
          />
          <TouchableOpacity
            style={[measStyles.alignNextBtn, { marginTop: 14 }]}
            onPress={() => setStep(3)} activeOpacity={0.8}>
            <Text style={measStyles.alignNextBtnText}>Next →</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Step 3: Measure ── */}
      {step === 3 && (
        <>
          <View style={measStyles.typedAnswerRow}>
            <Text style={measStyles.typedAnswerLabel}>What angle do you measure?</Text>
            <View style={measStyles.typedAnswerInputWrap}>
              <TextInput
                ref={inputRef}
                style={measStyles.typedAnswerInput}
                keyboardType="numeric" returnKeyType="done" maxLength={3}
                value={typedAnswer}
                onChangeText={t => setTypedAnswer(t.replace(/[^0-9]/g, ''))}
                onSubmitEditing={handleFinalSubmit}
                placeholder="___" placeholderTextColor="#475569"
              />
              <Text style={measStyles.typedAnswerUnit}>°</Text>
            </View>
          </View>

          {!feedback && (
            <View style={measStyles.alignActionRow}>
              <TouchableOpacity
                style={measStyles.alignClearBtn}
                onPress={() => setTypedAnswer('')} activeOpacity={0.8}>
                <Text style={measStyles.alignClearBtnText}>↺  Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={measStyles.alignNextBtn}
                onPress={handleFinalSubmit} activeOpacity={0.8}>
                <Text style={measStyles.alignNextBtnText}>Check  →</Text>
              </TouchableOpacity>
            </View>
          )}

          {isWrong && (
            <View style={styles.fillInReveal}>
              {wrongMsg ? <Text style={[styles.fillInRevealLabel, { color: '#fbbf24', marginBottom: 4 }]}>{wrongMsg}</Text> : null}
              <Text style={styles.fillInRevealLabel}>Correct angle:</Text>
              <Text style={styles.fillInRevealAnswer}>{q.correctAnswer}°</Text>
            </View>
          )}
          {isCorrect && <Text style={styles.fillInCorrectMsg}>Correct! 📐</Text>}
        </>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: Estimate  (angle stimulus + 4 MC degree buttons + motivational banner)
// ─────────────────────────────────────────────────────────────────────────────
function EstimateMode({ q, geo, onResolve, styles }) {
  const angleDeg              = geo?.angleDeg ?? parseFloat(q.correctAnswer ?? '60');
  const { options, correct }  = useMemo(() => buildEstimateOptions(angleDeg), [angleDeg]);
  const [chosen,   setChosen] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const { anim: shakeAnim, shake } = useShake();

  function handleChoice(val) {
    if (feedback) return;
    const ok = val === correct;
    setChosen(val);
    setFeedback(ok ? 'correct' : 'wrong');
    ok ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
       : (shake(), Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    setTimeout(() => onResolve(ok), 1400);
  }

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <AngleStimulus geometry={geo} />

      <View style={measStyles.estimateGrid}>
        {options.map(opt => {
          const picked = chosen === opt;
          const isOk   = !!feedback && opt === correct;
          const isBad  = !!feedback && picked && !isOk;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                measStyles.estimateBtn,
                isOk  && measStyles.estimateBtnCorrect,
                isBad && measStyles.estimateBtnWrong,
                feedback && !isOk && !isBad && measStyles.estimateBtnDimmed,
              ]}
              onPress={() => handleChoice(opt)}
              disabled={!!feedback}
              activeOpacity={0.8}>
              <Text style={[measStyles.estimateBtnText, (isOk || isBad) && { color: '#fff' }]}>
                {opt}°
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={measStyles.estimateBanner}>
        <Text style={measStyles.estimateBannerText}>
          📐  Estimation helps you become a better angle thinker!
        </Text>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: Spot the Mistake  (protractor display + two avatar claim cards + neither)
// geo must include: claimA { name, valueDeg }, claimB { name, valueDeg },
// correctClaim: 'A' | 'B' | 'neither'
// ─────────────────────────────────────────────────────────────────────────────
function SpotMistakeMode({ q, geo, onResolve, styles }) {
  const angleDeg     = geo?.angleDeg ?? parseFloat(q.correctAnswer ?? '70');
  const isFlipped    = geo?.flipped === true;
  const claimA       = geo?.claimA       ?? { name: 'Nina', valueDeg: angleDeg };
  const claimB       = geo?.claimB       ?? { name: 'Sam',  valueDeg: 180 - angleDeg };
  const correctClaim = geo?.correctClaim ?? (q.correctAnswer ?? 'A');

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);
  const { anim: shakeAnim, shake } = useShake();

  function handleChoice(pick) {
    if (feedback) return;
    const ok = pick === correctClaim;
    setChosen(pick);
    setFeedback(ok ? 'correct' : 'wrong');
    ok ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
       : (shake(), Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    setTimeout(() => onResolve(ok), 1800);
  }

  function claimBtnStyle(pick) {
    if (!feedback) return measStyles.claimBtn;
    if (pick === correctClaim) return [measStyles.claimBtn, measStyles.claimBtnCorrect];
    if (pick === chosen)       return [measStyles.claimBtn, measStyles.claimBtnWrong];
    return [measStyles.claimBtn, measStyles.claimBtnDimmed];
  }

  const avatarA = AVATAR_MAP[claimA.name.toLowerCase()] ?? AVATAR_MAP.nina;
  const avatarB = AVATAR_MAP[claimB.name.toLowerCase()] ?? AVATAR_MAP.sam;

  const correctLabel =
    correctClaim === 'A'       ? `${claimA.name} (${claimA.valueDeg}°)` :
    correctClaim === 'B'       ? `${claimB.name} (${claimB.valueDeg}°)` :
                                 'They are both wrong';

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      {/* Protractor shows the angle; no movable arm (student just observes) */}
      <ProtractorFace
        refAngle={angleDeg}
        movableAngle={angleDeg}
        isFlipped={isFlipped}
        showRefArm
        showMovable={false}
        geo={geo}
      />

      {/* Two claim buttons side by side */}
      <View style={measStyles.claimRow}>
        {[
          { pick: 'A', label: claimA.name, value: `(${claimA.valueDeg}°)`, avatar: avatarA },
          { pick: 'B', label: claimB.name, value: `(${claimB.valueDeg}°)`, avatar: avatarB },
        ].map(({ pick, label, value, avatar }) => (
          <TouchableOpacity
            key={pick}
            style={claimBtnStyle(pick)}
            onPress={() => handleChoice(pick)}
            disabled={!!feedback}
            activeOpacity={0.8}>
            <Image source={avatar} style={measStyles.claimAvatar} />
            <Text style={measStyles.claimName}>{label}</Text>
            <Text style={measStyles.claimValue}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* "Both wrong" option */}
      <TouchableOpacity
        style={[
          measStyles.neitherBtn,
          feedback && correctClaim === 'neither' && measStyles.neitherBtnCorrect,
          feedback && chosen === 'neither' && correctClaim !== 'neither' && measStyles.neitherBtnWrong,
        ]}
        onPress={() => handleChoice('neither')}
        disabled={!!feedback}
        activeOpacity={0.8}>
        <Text style={measStyles.neitherBtnText}>They are both wrong</Text>
      </TouchableOpacity>

      <Text style={measStyles.spotHint}>
        💡  Check which scale to use and read carefully.
      </Text>

      {feedback === 'wrong' && (
        <View style={styles.fillInReveal}>
          <Text style={styles.fillInRevealLabel}>Correct answer:</Text>
          <Text style={styles.fillInRevealAnswer}>{correctLabel}</Text>
        </View>
      )}
      {feedback === 'correct' && (
        <Text style={styles.fillInCorrectMsg}>Correct! 📐</Text>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — dispatches to the correct mode component
// ─────────────────────────────────────────────────────────────────────────────
export default function ProtractorRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const geo  = q.geometry?.type === 'angle' ? q.geometry : null;
  const mode = geo?.protractorMode ?? 'align';

  if (mode === 'estimate')     return <EstimateMode    q={q} geo={geo} onResolve={onResolve} styles={styles} />;
  if (mode === 'spot_mistake') return <SpotMistakeMode q={q} geo={geo} onResolve={onResolve} styles={styles} />;
  if (mode === 'align')        return <AlignMode       q={q} geo={geo} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
  return <ReadBuildMode q={q} geo={geo} mode={mode} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
}
