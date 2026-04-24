import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TextInput, TouchableOpacity, Animated, PanResponder, Keyboard } from 'react-native';
import { armStyle } from '../shared/measurementHelpers';
import { measStyles, PROT_R, PROT_CX, PROT_CY, SLIDER_W } from '../shared/measurementStyles';

const PROT_LABEL_MARKS = [0, 30, 45, 60, 90, 120, 135, 150, 180];
const PROT_TICK_STEP   = 10;

// Returns a hint string when the student's typed value reveals a specific
// misconception; null for generic errors.
function protractorDiagnostic(typed, correct, geo) {
  if (isNaN(typed)) return null;
  const opposite = 180 - correct;
  if (Math.abs(typed - opposite) <= 8) {
    const side = geo?.scaleOrigin === 'right' ? 'right' : geo?.scaleOrigin === 'left' ? 'left' : null;
    const sideHint = side ? ` Start at the 0° on the ${side} side.` : '';
    return `You read from the wrong scale.${sideHint}`;
  }
  if (correct < 90 && typed > 90) return 'This is an acute angle — it must be less than 90°.';
  if (correct > 90 && typed < 90) return 'This is an obtuse angle — it must be greater than 90°.';
  if (correct === 90 && typed !== 90) return 'This is a right angle — it should be exactly 90°.';
  return null;
}

export default function ProtractorRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const geo         = q.geometry?.type === 'angle' ? q.geometry : null;
  const mode        = geo?.protractorMode ?? 'align';
  const scaleOrigin = geo?.scaleOrigin ?? null;

  const [angleDeg,    setAngleDeg]    = useState(90);
  const [feedback,    setFeedback]    = useState(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [scaleChosen, setScaleChosen] = useState(null);
  const [scaleError,  setScaleError]  = useState(null);
  const [wrongMsg,    setWrongMsg]    = useState(null);
  const sliderXRef = useRef((90 / 180) * SLIDER_W);
  const startXRef  = useRef(sliderXRef.current);
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const inputRef   = useRef(null);

  const sliderLocked    = scaleOrigin != null && scaleChosen !== scaleOrigin;
  const feedbackRef     = useRef(null);
  const sliderLockedRef = useRef(false);
  feedbackRef.current     = feedback;
  sliderLockedRef.current = sliderLocked;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => !feedbackRef.current && !sliderLockedRef.current,
      onMoveShouldSetPanResponderCapture:  () => !sliderLockedRef.current,
      onStartShouldSetPanResponder:        () => !feedbackRef.current && !sliderLockedRef.current,
      onMoveShouldSetPanResponder:         () => !sliderLockedRef.current,
      onPanResponderTerminationRequest:    () => false,
      onPanResponderGrant: (e) => {
        if (sliderLockedRef.current) return;
        setScrollEnabled?.(false);
        const x = Math.max(0, Math.min(SLIDER_W, e.nativeEvent.locationX));
        sliderXRef.current = x; startXRef.current = x;
        setAngleDeg(Math.round((x / SLIDER_W) * 180));
      },
      onPanResponderMove: (_, gs) => {
        if (sliderLockedRef.current) return;
        const nx = Math.max(0, Math.min(SLIDER_W, startXRef.current + gs.dx));
        sliderXRef.current = nx;
        setAngleDeg(Math.round((nx / SLIDER_W) * 180));
      },
      onPanResponderRelease:   () => { setScrollEnabled?.(true); },
      onPanResponderTerminate: () => { setScrollEnabled?.(true); },
    })
  ).current;

  function handleScaleChoice(choice) {
    if (feedback) return;
    if (choice === scaleOrigin) {
      setScaleChosen(choice); setScaleError(null);
    } else {
      const ray     = geo?.ray1 ?? 'the baseline ray';
      const correct = scaleOrigin === 'right' ? 'right' : 'left';
      setScaleError(`Not quite — ${ray} lies along the ${correct} side, so start from the ${correct} 0°.`);
      shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function handleSubmit() {
    if (feedback) return;
    Keyboard.dismiss();
    const correct = parseFloat(q.correctAnswer ?? '0');
    if (mode === 'build') {
      const isCorrect = Math.abs(angleDeg - correct) <= 5;
      setFeedback(isCorrect ? 'correct' : 'wrong');
      if (isCorrect) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else         { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
      setTimeout(() => onResolve(isCorrect), 1400);
      return;
    }
    const typed = parseFloat(typedAnswer.trim());
    if (isNaN(typed) || typedAnswer.trim() === '') {
      setScaleError('Enter the degree number before checking.'); return;
    }
    setScaleError(null);
    const isCorrect = Math.abs(typed - correct) <= 5;
    const diag = isCorrect ? null : protractorDiagnostic(typed, correct, geo);
    setWrongMsg(diag);
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else         { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(isCorrect), 1800);
  }

  const isCorrect  = feedback === 'correct';
  const isWrong    = feedback === 'wrong';
  const armColor   = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#7c3aed';
  const sliderLeft = (angleDeg / 180) * SLIDER_W;
  const refAngle   = parseFloat(q.correctAnswer ?? '0');
  const isFlipped  = geo?.flipped === true;

  const baselineScreenDeg = isFlipped ? 180 : 0;
  const refArmScreenDeg   = isFlipped ? 180 - refAngle : refAngle;
  const movableScreenDeg  = isFlipped ? 180 - angleDeg : angleDeg;

  const labelDist   = PROT_R + 32;
  const refArmRad   = (refArmScreenDeg * Math.PI) / 180;
  const baselineRad = (baselineScreenDeg * Math.PI) / 180;
  const refTipX     = PROT_CX + labelDist * Math.cos(refArmRad);
  const refTipY     = PROT_CY - labelDist * Math.sin(refArmRad);
  const r0TipX      = PROT_CX + labelDist * Math.cos(baselineRad);
  const r0TipY      = PROT_CY - labelDist * Math.sin(baselineRad);

  const labelValue  = (mark) => isFlipped ? 180 - mark : mark;
  const showRefArm  = mode !== 'build';
  const showReadout = !!feedback;
  const needsTypedInput = mode !== 'build';
  const showSlider  = mode !== 'read';
  const showScaleStep = scaleOrigin != null && scaleChosen !== scaleOrigin;

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      {showScaleStep && (
        <View style={measStyles.scaleChoiceBox}>
          <Text style={measStyles.scaleChoicePrompt}>Which 0° do you start reading from?</Text>
          <View style={measStyles.scaleChoiceRow}>
            <TouchableOpacity
              style={[measStyles.scaleChoiceBtn, scaleChosen === 'left' && measStyles.scaleChoiceBtnSelected]}
              onPress={() => handleScaleChoice('left')} activeOpacity={0.75}>
              <Text style={measStyles.scaleChoiceBtnText}>← Left side</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[measStyles.scaleChoiceBtn, scaleChosen === 'right' && measStyles.scaleChoiceBtnSelected]}
              onPress={() => handleScaleChoice('right')} activeOpacity={0.75}>
              <Text style={measStyles.scaleChoiceBtnText}>Right side →</Text>
            </TouchableOpacity>
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

      <View style={[measStyles.protContainer, showScaleStep && { opacity: 0.35 }]}>
        <View style={[measStyles.protArc, { left: PROT_CX - PROT_R, top: PROT_CY - PROT_R }]} />
        <View style={{ position: 'absolute', left: PROT_CX - PROT_R - 6, top: PROT_CY - 1, width: PROT_R * 2 + 12, height: 1.5, backgroundColor: '#475569' }} />

        {Array.from({ length: 19 }, (_, i) => i * PROT_TICK_STEP).map(deg => {
          if (PROT_LABEL_MARKS.includes(deg)) return null;
          const r   = (deg * Math.PI) / 180;
          const tx1 = PROT_CX + (PROT_R - 4) * Math.cos(r);
          const ty1 = PROT_CY - (PROT_R - 4) * Math.sin(r);
          return <View key={deg} style={armStyle(tx1, ty1, 8, deg, '#334155', 1.5)} />;
        })}

        {showRefArm && (
          <>
            <View style={armStyle(PROT_CX, PROT_CY, PROT_R + 18, refArmScreenDeg, '#e2e8f0', 1.5)} />
            {Array.from({ length: Math.round(refAngle / 3) }, (_, i) => {
              const t = Math.round(refAngle / 3) > 0 ? i / Math.round(refAngle / 3) : 0;
              const a = isFlipped
                ? baselineScreenDeg - t * refAngle
                : t * refAngle;
              const r = (a * Math.PI) / 180;
              return <View key={i} style={{ position: 'absolute', left: PROT_CX + 36 * Math.cos(r) - 1.5, top: PROT_CY - 36 * Math.sin(r) - 1.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#7c3aed', opacity: 0.5 }} />;
            })}
          </>
        )}

        <View style={armStyle(PROT_CX, PROT_CY, PROT_R - 6, baselineScreenDeg, '#475569')} />
        {showSlider && (
          <View style={armStyle(PROT_CX, PROT_CY, PROT_R - 6, movableScreenDeg, armColor, 3)} />
        )}

        <View style={{ position: 'absolute', left: PROT_CX - 5, top: PROT_CY - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#94a3b8' }} />

        {PROT_LABEL_MARKS.map(mark => {
          const rad  = (mark * Math.PI) / 180;
          const lx   = PROT_CX + (PROT_R + 18) * Math.cos(rad);
          const ly   = PROT_CY - (PROT_R + 18) * Math.sin(rad);
          const isNear = showSlider && Math.abs(labelValue(mark) - angleDeg) <= 6;
          return (
            <Text key={mark} style={[measStyles.protMarkLabel, { left: lx - 13, top: ly - 8 }, isNear && { color: armColor, fontWeight: '800' }]}>
              {labelValue(mark)}°
            </Text>
          );
        })}

        {geo && <>
          <Text style={[measStyles.protRayLabel, { left: PROT_CX - 8, top: PROT_CY + 10 }]}>{geo.vertex}</Text>
          <Text style={[measStyles.protRayLabel, { left: r0TipX - 6, top: r0TipY - 9 }]}>{geo.ray1}</Text>
          {showRefArm && (
            <Text style={[measStyles.protRayLabel, { left: refTipX - 6, top: refTipY - 9 }]}>{geo.ray2}</Text>
          )}
        </>}

        {showReadout && (
          <Text style={[measStyles.protReadout, isCorrect && { color: '#4ade80' }, isWrong && { color: '#f87171' }]}>
            {mode === 'build' ? `${angleDeg}°` : `${typedAnswer}°`}
          </Text>
        )}
      </View>

      {mode === 'build' && !feedback && (
        <Text style={measStyles.buildModeLabel}>
          Create a {refAngle}° angle — drag the arm to the right position
        </Text>
      )}

      {showSlider && (
        <>
          <View style={[measStyles.sliderRow, sliderLocked && { opacity: 0.35 }]}>
            <Text style={measStyles.sliderEndLabel}>0°</Text>
            <View style={measStyles.sliderTrack} {...(!sliderLocked ? panResponder.panHandlers : {})}>
              <View style={[measStyles.sliderFill, { width: sliderLeft }]} />
              <View style={[measStyles.sliderHandle, { left: sliderLeft - 12 }]} pointerEvents="none" />
            </View>
            <Text style={measStyles.sliderEndLabel}>180°</Text>
          </View>
          {sliderLocked
            ? <Text style={measStyles.sliderHint}>Choose the scale above first</Text>
            : <Text style={measStyles.sliderHint}>Tap or drag anywhere on the bar</Text>
          }
        </>
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
          <Text style={styles.fillInSubmitText}>Check Angle</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
