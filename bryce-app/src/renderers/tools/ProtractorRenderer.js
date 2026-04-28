import React, { useState, useRef, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TextInput, TouchableOpacity,
  Animated, PanResponder, Image, Keyboard,
} from 'react-native';
import Svg, {
  Path, Line, Circle, Rect,
  Text as SvgText, Defs, LinearGradient, Stop,
} from 'react-native-svg';
import { AngleStimulus } from '../shared/measurementHelpers';
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

// ── Label constants ──────────────────────────────────────────────────────────
// Primary scale: label every 10°, bold at 30° multiples
const ALL_10_MARKS   = [0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180];
const MAJOR_MARK_SET = new Set([0, 30, 60, 90, 120, 150, 180]);
// Secondary (complementary) scale shown only at 30°/60°/90°/120°/150°
const SECONDARY_MARKS = [30, 60, 90, 120, 150];

// Returns the 4 closest multiples of 30 from [30,60,90,120,150] to angleDeg,
// sorted ascending. Used by EstimateMode.
function buildEstimateOptions(angleDeg) {
  const ALL     = [30, 60, 90, 120, 150];
  const correct = ALL.reduce((b, v) => Math.abs(v - angleDeg) < Math.abs(b - angleDeg) ? v : b);
  const sorted  = [...ALL].sort((a, b) => Math.abs(a - angleDeg) - Math.abs(b - angleDeg));
  return { options: sorted.slice(0, 4).sort((a, b) => a - b), correct };
}

// Returns the 3 closest multiples of 30 to angleDeg, sorted ascending.
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

// Diagnostic message for estimate wrong answers
function estimateDiagnosticMsg(chosen, correct, angleDeg) {
  if (chosen === correct) return null;
  const isAcute  = angleDeg < 90;
  const isObtuse = angleDeg > 90;
  if (isAcute && chosen >= 90)
    return `${chosen}° is a right angle or obtuse — but this angle is acute (less than 90°). ${correct}° is the best fit.`;
  if (isObtuse && chosen <= 90)
    return `${chosen}° is a right angle or acute — but this angle is obtuse (greater than 90°). ${correct}° fits better.`;
  if (chosen < correct)
    return `Close! But this angle is a little wider than ${chosen}°. ${correct}° is the better estimate.`;
  return `Close! But ${chosen}° is a bit too wide for this angle. ${correct}° fits better.`;
}

// Relational build hint after wrong attempt
function buildRelationalHint(targetDeg) {
  if (targetDeg < 90)
    return `${targetDeg}° is acute — your arm should be to the left of the 90° mark, not yet straight up.`;
  if (targetDeg > 90)
    return `${targetDeg}° is obtuse — your arm should be past the 90° mark, leaning toward the left side.`;
  return `${targetDeg}° is a right angle — your arm should point straight up at the top of the protractor.`;
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
// ProtractorFace — SVG implementation.
//
// Fixes over v1:
//  • Larger canvas (310 × 200) so the arc fills more screen width.
//  • Semi-disc face background — labels are legible against the dark fill.
//  • Solid sector fill (28 % opacity) — clearly visible.
//  • 0° / 180° labels pushed above the baseline so they don't sit on the line.
//  • Badge Y is clamped so it never overflows the canvas top.
//  • Tick colours follow a 3-tier contrast hierarchy.
// ─────────────────────────────────────────────────────────────────────────────

const SVG_W  = 310;
const SVG_H  = 200;
const SVG_CX = 155;   // horizontal centre of canvas
const SVG_CY = 160;   // baseline y — leaves ~40 px below for vertex label
const SVG_R  = 132;   // arc radius (larger than the old PROT_R = 108)

// Point on circle of radius r at screen degree deg (0 = right, CCW positive).
function pt(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

// Pie-slice sector: M center L arcStart A ... arcEnd Z
//
// Sweep direction rules (SVG y-axis points DOWN):
//   • Face / arc paths start from the LEFT endpoint → sweep-flag=1 (CW) → goes upward ✓
//   • Sector starts from a point on the RIGHT half (low degree) and sweeps toward the
//     LEFT half (high degree).  From the right side, sweep-flag=0 (CCW in SVG) goes
//     UPWARD through the top semicircle.  sweep-flag=1 would go downward — wrong.
function sectorPath(cx, cy, r, startDeg, endDeg) {
  const lo    = Math.min(startDeg, endDeg);
  const hi    = Math.max(startDeg, endDeg);
  const p1    = pt(cx, cy, r, lo);
  const p2    = pt(cx, cy, r, hi);
  const large = (hi - lo) > 180 ? 1 : 0;
  // sweep-flag=0: CCW in SVG from the right-side start = travels upward ✓
  return (
    `M ${cx},${cy} ` +
    `L ${p1.x.toFixed(2)},${p1.y.toFixed(2)} ` +
    `A ${r},${r} 0 ${large} 0 ${p2.x.toFixed(2)},${p2.y.toFixed(2)} Z`
  );
}

function ProtractorFace({
  refAngle,
  movableAngle,
  isFlipped   = false,
  showRefArm  = true,
  showMovable = true,
  armColor    = '#7c3aed',
  geo,
  showReadout = false,
  readoutText = '',
}) {
  const cx = SVG_CX, cy = SVG_CY, R = SVG_R;

  // Screen-space degrees (0 = right, CCW positive)
  const baselineDeg = isFlipped ? 180 : 0;
  const refDeg      = isFlipped ? 180 - refAngle     : refAngle;
  const movDeg      = isFlipped ? 180 - movableAngle : movableAngle;

  // Sector: from baseline toward the active arm
  const fillAngle   = showRefArm ? refAngle : showMovable ? movableAngle : 0;
  const sectorStart = isFlipped ? 180 - fillAngle : 0;
  const sectorEnd   = isFlipped ? 180             : fillAngle;

  // Arc dots near vertex (angle indicator)
  const dotCount = Math.round(refAngle / 3);
  const arcDots  = showRefArm
    ? Array.from({ length: dotCount }, (_, i) => {
        const t   = dotCount > 0 ? i / dotCount : 0;
        const deg = isFlipped ? baselineDeg - t * refAngle : t * refAngle;
        return { ...pt(cx, cy, 40, deg), key: i };
      })
    : [];

  // Movable arm pip + floating badge
  const movPt  = pt(cx, cy, R, movDeg);
  // Badge: keep Y at least 14 px from the top of the canvas so it doesn't overflow
  const rawBadgePt = pt(cx, cy, R + 24, movDeg);
  const badgeX     = rawBadgePt.x - 19;
  const badgeY     = Math.max(8, rawBadgePt.y - 9);

  // Ray label endpoints (beyond arc)
  const rayDist   = R + 46;
  const refRayPt  = pt(cx, cy, rayDist, refDeg);
  const baseRayPt = pt(cx, cy, rayDist, baselineDeg);

  // For labels at 0° and 180° the computed y equals cy (on the baseline).
  // Push them 14 px above the baseline so they sit cleanly on the face.
  function labelY(markDeg, rawY) {
    return (markDeg === 0 || markDeg === 180) ? cy - 14 : rawY + 4;
  }

  return (
    <View style={[measStyles.protContainer, { width: SVG_W, height: SVG_H }]}>
      <Svg width={SVG_W} height={SVG_H} overflow="visible">

        {/* ── 0. Semi-disc face background ── */}
        {/* sweep-flag=1 (CW from left) takes the TOP arc, not the bottom */}
        <Path
          d={`M ${cx - R},${cy} A ${R},${R} 0 0 1 ${cx + R},${cy} Z`}
          fill="#1a2535"
        />

        {/* ── 1. Filled angle sector ── */}
        {fillAngle > 0 && (
          <Path
            d={sectorPath(cx, cy, R - 5, sectorStart, sectorEnd)}
            fill="rgba(96,165,250,0.28)"
          />
        )}

        {/* ── 2. Inner arc ring (label-belt separator) ── */}
        <Path
          d={`M ${cx - (R - 30)},${cy} A ${R - 30},${R - 30} 0 0 1 ${cx + (R - 30)},${cy}`}
          fill="none" stroke="#2d3a4a" strokeWidth="1"
        />

        {/* ── 3. Outer arc ── */}
        <Path
          d={`M ${cx - R},${cy} A ${R},${R} 0 0 1 ${cx + R},${cy}`}
          fill="none" stroke="#64748b" strokeWidth="2"
        />

        {/* ── 4. Baseline ── */}
        <Line
          x1={cx - R - 12} y1={cy}
          x2={cx + R + 12} y2={cy}
          stroke="#64748b" strokeWidth="1.5"
        />

        {/* ── 5. Tick marks — minor 5°, medium 10°, major 30° ── */}
        {Array.from({ length: 37 }, (_, i) => i * 5).map(deg => {
          if (deg < 0 || deg > 180) return null;
          const isMajor = deg % 30 === 0;
          const isMed   = !isMajor && deg % 10 === 0;
          const tickLen = isMajor ? 13 : isMed ? 9 : 5;
          const outer   = pt(cx, cy, R, deg);
          const inner   = pt(cx, cy, R - tickLen, deg);
          return (
            <Line
              key={`t${deg}`}
              x1={outer.x.toFixed(2)} y1={outer.y.toFixed(2)}
              x2={inner.x.toFixed(2)} y2={inner.y.toFixed(2)}
              stroke={isMajor ? '#94a3b8' : isMed ? '#475569' : '#2d3748'}
              strokeWidth={isMajor ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── 6. Primary scale labels (every 10°, larger + bold at 30° multiples) ── */}
        {ALL_10_MARKS.map(mark => {
          const { x, y } = pt(cx, cy, R - 16, mark);
          const isMajor  = MAJOR_MARK_SET.has(mark);
          const val      = isFlipped ? 180 - mark : mark;
          const near     = showMovable && Math.abs(val - movableAngle) <= 3;
          return (
            <SvgText
              key={`p${mark}`}
              x={x.toFixed(2)} y={labelY(mark, y).toFixed(2)}
              textAnchor="middle"
              fontSize={isMajor ? 12 : 9}
              fontWeight={near || isMajor ? 'bold' : 'normal'}
              fill={near ? armColor : isMajor ? '#cbd5e1' : '#64748b'}
            >
              {isMajor ? `${val}°` : `${val}`}
            </SvgText>
          );
        })}

        {/* ── 7. Secondary scale labels (inner ring, 30° multiples only) ── */}
        {SECONDARY_MARKS.map(mark => {
          const { x, y } = pt(cx, cy, R - 28, mark);
          const val = isFlipped ? mark : 180 - mark;
          return (
            <SvgText
              key={`s${mark}`}
              x={x.toFixed(2)} y={(y + 4).toFixed(2)}
              textAnchor="middle"
              fontSize="8"
              fill="#3d4f63"
            >
              {val}
            </SvgText>
          );
        })}

        {/* ── 8. Arc dots near vertex ── */}
        {arcDots.map(dot => (
          <Circle
            key={dot.key}
            cx={dot.x.toFixed(2)} cy={dot.y.toFixed(2)}
            r="1.8" fill="#7c3aed" opacity="0.7"
          />
        ))}

        {/* ── 9. Baseline arm ── */}
        {(() => {
          const tip = pt(cx, cy, R + 12, baselineDeg);
          return (
            <Line x1={cx} y1={cy} x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
              stroke="#64748b" strokeWidth="1.5" />
          );
        })()}

        {/* ── 10. Reference arm ── */}
        {showRefArm && (() => {
          const tip = pt(cx, cy, R + 16, refDeg);
          return (
            <Line x1={cx} y1={cy} x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
              stroke="#e2e8f0" strokeWidth="2" />
          );
        })()}

        {/* ── 11. Movable arm ── */}
        {showMovable && (() => {
          const tip = pt(cx, cy, R - 4, movDeg);
          return (
            <Line x1={cx} y1={cy} x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
              stroke={armColor} strokeWidth="3.5" strokeLinecap="round" />
          );
        })()}

        {/* ── 12. Pip on arc + floating degree badge ── */}
        {showMovable && <>
          <Circle
            cx={movPt.x.toFixed(2)} cy={movPt.y.toFixed(2)}
            r="5.5" fill={armColor} stroke="white" strokeWidth="2"
          />
          <Rect
            x={badgeX.toFixed(2)} y={badgeY.toFixed(2)}
            width="40" height="20" rx="6" fill={armColor}
          />
          <SvgText
            x={(badgeX + 20).toFixed(2)} y={(badgeY + 14).toFixed(2)}
            textAnchor="middle" fontSize="12" fontWeight="bold" fill="white"
          >
            {movableAngle}°
          </SvgText>
        </>}

        {/* ── 13. Centre pivot ── */}
        <Circle cx={cx} cy={cy} r="5.5" fill="#94a3b8" />

        {/* ── 14. Ray / vertex labels ── */}
        {geo && <>
          <SvgText
            x={cx} y={cy + 24}
            textAnchor="middle" fontSize="16" fontWeight="bold" fontStyle="italic" fill="#e2e8f0"
          >
            {geo.vertex}
          </SvgText>
          <SvgText
            x={baseRayPt.x.toFixed(2)} y={(baseRayPt.y + 5).toFixed(2)}
            textAnchor="middle" fontSize="16" fontWeight="bold" fontStyle="italic" fill="#e2e8f0"
          >
            {geo.ray1}
          </SvgText>
          {showRefArm && (
            <SvgText
              x={refRayPt.x.toFixed(2)} y={(refRayPt.y + 5).toFixed(2)}
              textAnchor="middle" fontSize="16" fontWeight="bold" fontStyle="italic" fill="#e2e8f0"
            >
              {geo.ray2}
            </SvgText>
          )}
        </>}

        {/* ── 15. Angle readout (post-submit overlay) ── */}
        {showReadout && (
          <SvgText
            x={cx} y={cy - 50}
            textAnchor="middle" fontSize="24" fontWeight="bold" fill={armColor}
          >
            {readoutText}
          </SvgText>
        )}

      </Svg>
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
          {/* Relational hint for build mode */}
          {mode === 'build' && (
            <Text style={[styles.fillInRevealLabel, { color: '#fbbf24', marginBottom: 6 }]}>
              {buildRelationalHint(refAngle)}
            </Text>
          )}
          {wrongMsg ? (
            <Text style={[styles.fillInRevealLabel, { color: '#fbbf24', marginBottom: 4 }]}>{wrongMsg}</Text>
          ) : null}
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
// Step 2 gates the Next button — the movable arm must be within ±10° of the
// correct angle before the student can proceed to Step 3.
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
  const [alignWarn,      setAlignWarn]      = useState(false);
  const { anim: shakeAnim, shake }          = useShake();
  const inputRef                            = useRef(null);

  const estimateOpts = useMemo(() => buildAlignEstimateOptions(correctAngle), [correctAngle]);

  const STEP_LABELS = [
    'Estimate: How large is this angle?',
    `Move the purple arm until it lines up with ray ${geo?.ray2 ?? 'Z'}. Start from the 0° baseline.`,
    'Type the measure.',
  ];

  function handleEstimate(val) {
    setEstimateChoice(val);
    setTimeout(() => setStep(2), 350);
  }

  // Step 2 → Step 3: arm must be within ±10° of correct angle
  function handleAdvanceToStep3() {
    if (Math.abs(movableAngle - correctAngle) > 10) {
      setAlignWarn(true);
      setTimeout(() => setAlignWarn(false), 3000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setAlignWarn(false);
    setStep(3);
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
          {alignWarn && (
            <Text style={measStyles.alignWarnText}>
              That arm doesn't look lined up yet — try moving it closer to match the ray.
            </Text>
          )}
          <TouchableOpacity
            style={[measStyles.alignNextBtn, { marginTop: alignWarn ? 8 : 14 }]}
            onPress={handleAdvanceToStep3} activeOpacity={0.8}>
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
// After a wrong answer, a diagnostic message explains the angle type so
// students understand WHY the correct choice fits better.
// ─────────────────────────────────────────────────────────────────────────────
function EstimateMode({ q, geo, onResolve, styles }) {
  const angleDeg              = geo?.angleDeg ?? parseFloat(q.correctAnswer ?? '60');
  const { options, correct }  = useMemo(() => buildEstimateOptions(angleDeg), [angleDeg]);
  const [chosen,      setChosen]      = useState(null);
  const [feedback,    setFeedback]    = useState(null);
  const [diagMsg,     setDiagMsg]     = useState(null);
  const { anim: shakeAnim, shake } = useShake();

  function handleChoice(val) {
    if (feedback) return;
    const ok = val === correct;
    setChosen(val);
    setFeedback(ok ? 'correct' : 'wrong');
    if (!ok) setDiagMsg(estimateDiagnosticMsg(val, correct, angleDeg));
    ok ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
       : (shake(), Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    setTimeout(() => onResolve(ok), ok ? 1400 : 2200);
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

      {/* Diagnostic feedback after a wrong answer */}
      {feedback === 'wrong' && diagMsg && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>{diagMsg}</Text>
        </View>
      )}

      {/* Motivational banner (shown on correct or no-answer) */}
      {feedback !== 'wrong' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            📐  Estimation helps you become a better angle thinker!
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: Spot the Mistake  (protractor display + two avatar claim cards + neither)
// After the answer, a brief explanation teaches WHY reading from the wrong
// scale gives the supplementary angle.
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

  // Figure out which student used which scale for the post-answer explanation
  const wrongStudent = correctClaim === 'A' ? claimB : (correctClaim === 'B' ? claimA : null);
  const rightStudent = correctClaim === 'A' ? claimA : (correctClaim === 'B' ? claimB : null);

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

      {/* Post-answer scale explanation — teaches the inner/outer scale concept */}
      {feedback && wrongStudent && rightStudent && (
        <View style={measStyles.spotExplanation}>
          <Text style={measStyles.spotExplanationText}>
            {`${rightStudent.name} read ${rightStudent.valueDeg}° by starting from the correct 0° line on the baseline ray. ${wrongStudent.name} started from the other 0° and got the supplementary angle (${wrongStudent.valueDeg}°). Always find which 0° the baseline ray points to — that is the scale to read from.`}
          </Text>
        </View>
      )}
      {feedback && correctClaim === 'neither' && (
        <View style={measStyles.spotExplanation}>
          <Text style={measStyles.spotExplanationText}>
            {`Both students read from the wrong scale. The correct angle is ${angleDeg}°. The other reading (${180 - angleDeg}°) comes from starting at the wrong 0°. Always trace the baseline ray to its 0° before reading the scale.`}
          </Text>
        </View>
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
