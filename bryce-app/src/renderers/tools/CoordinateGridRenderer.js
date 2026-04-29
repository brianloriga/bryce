// CoordinateGridRenderer.js
// 5 modes: plot, read, multi_plot, missing, quadrant
// Points snap to exact integer intersections. Submit required — no live feedback during placement.
import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, Animated, PanResponder,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import Svg, { Line, Circle, Rect, Path, G, Text as SvgText } from 'react-native-svg';

// ── Layout constants ──────────────────────────────────────────
const GRID_PAD = 30;   // space for axis number labels
const DOT_R    = 8;    // point radius
const DOT_GHOST_R = 10;

// ── Color palette ─────────────────────────────────────────────
const POINT_COLORS = {
  red:    '#f87171', green: '#4ade80', blue:   '#60a5fa',
  purple: '#a78bfa', orange: '#fb923c', yellow: '#fbbf24',
};
const COLOR_ORDER = ['red', 'green', 'blue', 'purple', 'orange', 'yellow'];

const Q_TINT = {
  I:   'rgba(74,222,128,0.08)',
  II:  'rgba(96,165,250,0.08)',
  III: 'rgba(248,113,113,0.08)',
  IV:  'rgba(251,191,36,0.08)',
};
const Q_TINT_REVEAL = {
  I:   'rgba(74,222,128,0.22)',
  II:  'rgba(96,165,250,0.22)',
  III: 'rgba(248,113,113,0.22)',
  IV:  'rgba(251,191,36,0.22)',
};

// ── useGridLayout — responsive square canvas ──────────────────
function useGridLayout(gridRange = 5) {
  const { width } = useWindowDimensions();
  const W        = Math.min(width - 40, 320);
  const usable   = W - GRID_PAD * 2;
  const cellSize = usable / (gridRange * 2);
  return { W, usable, cellSize, gridRange };
}

// ── Coordinate ↔ pixel helpers ────────────────────────────────
function toPixelX(x, gridRange, cellSize)  { return GRID_PAD + (x + gridRange) * cellSize; }
function toPixelY(y, gridRange, cellSize)  { return GRID_PAD + (gridRange - y) * cellSize; }
function toGridX(px, gridRange, cellSize)  { return Math.round((px - GRID_PAD) / cellSize - gridRange); }
function toGridY(py, gridRange, cellSize)  { return Math.round(gridRange - (py - GRID_PAD) / cellSize); }
function clampGrid(v, r) { return Math.max(-r, Math.min(r, v)); }

function getQuadrant(x, y) {
  if (x > 0 && y > 0) return 'I';
  if (x < 0 && y > 0) return 'II';
  if (x < 0 && y < 0) return 'III';
  if (x > 0 && y < 0) return 'IV';
  return null;
}

// ── GridSvgContent — all SVG drawing elements ─────────────────
function GridSvgContent({
  W, cellSize, gridRange,
  showQuadrantTints  = false,
  revealQuadrant     = null,
  prePlacedPoints    = [],   // [{x,y,color,label}]
  ghostPoint         = null, // {x,y,color?,label?} — student preview
  submittedPoints    = [],   // [{x,y,color,label,correct}]
  showCoordLabel     = false, // floating x/y readout during drag
}) {
  const ox = toPixelX(0, gridRange, cellSize);
  const oy = toPixelY(0, gridRange, cellSize);
  const nums = [];
  for (let v = -gridRange; v <= gridRange; v++) nums.push(v);

  return (
    <>
      {/* Background */}
      <Rect x={0} y={0} width={W} height={W} fill="#0b1628" />

      {/* Quadrant tints (always subtle) */}
      {showQuadrantTints && (
        <>
          <Rect x={ox} y={GRID_PAD} width={W - GRID_PAD - ox} height={oy - GRID_PAD} fill={Q_TINT.I} />
          <Rect x={GRID_PAD} y={GRID_PAD} width={ox - GRID_PAD}    height={oy - GRID_PAD} fill={Q_TINT.II} />
          <Rect x={GRID_PAD} y={oy} width={ox - GRID_PAD}    height={W - GRID_PAD - oy} fill={Q_TINT.III} />
          <Rect x={ox} y={oy} width={W - GRID_PAD - ox} height={W - GRID_PAD - oy} fill={Q_TINT.IV} />
        </>
      )}

      {/* Revealed quadrant (post-answer highlight) */}
      {revealQuadrant === 'I'   && <Rect x={ox} y={GRID_PAD} width={W - GRID_PAD - ox} height={oy - GRID_PAD} fill={Q_TINT_REVEAL.I}   />}
      {revealQuadrant === 'II'  && <Rect x={GRID_PAD} y={GRID_PAD} width={ox - GRID_PAD}    height={oy - GRID_PAD} fill={Q_TINT_REVEAL.II}  />}
      {revealQuadrant === 'III' && <Rect x={GRID_PAD} y={oy} width={ox - GRID_PAD}    height={W - GRID_PAD - oy} fill={Q_TINT_REVEAL.III} />}
      {revealQuadrant === 'IV'  && <Rect x={ox} y={oy} width={W - GRID_PAD - ox} height={W - GRID_PAD - oy} fill={Q_TINT_REVEAL.IV}  />}

      {/* Grid lines */}
      {nums.map(v => {
        const px = toPixelX(v, gridRange, cellSize);
        const py = toPixelY(v, gridRange, cellSize);
        const isAxis = v === 0;
        return (
          <G key={`gl${v}`}>
            <Line x1={GRID_PAD} y1={py} x2={W - GRID_PAD} y2={py}
              stroke={isAxis ? '#2d4a6b' : '#162035'} strokeWidth={isAxis ? '1.5' : '1'} />
            <Line x1={px} y1={GRID_PAD} x2={px} y2={W - GRID_PAD}
              stroke={isAxis ? '#2d4a6b' : '#162035'} strokeWidth={isAxis ? '1.5' : '1'} />
          </G>
        );
      })}

      {/* X axis */}
      <Line x1={GRID_PAD - 6} y1={oy} x2={W - GRID_PAD + 8} y2={oy}
        stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      {/* Y axis */}
      <Line x1={ox} y1={GRID_PAD - 8} x2={ox} y2={W - GRID_PAD + 6}
        stroke="#475569" strokeWidth="2" strokeLinecap="round" />

      {/* Arrowheads */}
      <Path d={`M ${W - GRID_PAD + 8} ${oy} L ${W - GRID_PAD + 2} ${oy - 4.5} L ${W - GRID_PAD + 2} ${oy + 4.5} Z`} fill="#475569" />
      <Path d={`M ${GRID_PAD - 6} ${oy} L ${GRID_PAD - 1} ${oy - 4.5} L ${GRID_PAD - 1} ${oy + 4.5} Z`} fill="#475569" />
      <Path d={`M ${ox} ${GRID_PAD - 8} L ${ox - 4.5} ${GRID_PAD - 2} L ${ox + 4.5} ${GRID_PAD - 2} Z`} fill="#475569" />
      <Path d={`M ${ox} ${W - GRID_PAD + 6} L ${ox - 4.5} ${W - GRID_PAD} L ${ox + 4.5} ${W - GRID_PAD} Z`} fill="#475569" />

      {/* Tick marks + axis numbers */}
      {nums.filter(v => v !== 0).map(v => {
        const px = toPixelX(v, gridRange, cellSize);
        const py = toPixelY(v, gridRange, cellSize);
        return (
          <G key={`lab${v}`}>
            <Line x1={px} y1={oy - 3} x2={px} y2={oy + 3} stroke="#475569" strokeWidth="1.5" />
            <SvgText x={px} y={oy + 14} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#64748b">
              {v}
            </SvgText>
            <Line x1={ox - 3} y1={py} x2={ox + 3} y2={py} stroke="#475569" strokeWidth="1.5" />
            <SvgText x={ox - 7} y={py + 3.5} textAnchor="end" fontSize="9" fontWeight="bold" fill="#64748b">
              {v}
            </SvgText>
          </G>
        );
      })}

      {/* "x" and "y" axis labels */}
      <SvgText x={W - GRID_PAD + 20} y={oy + 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#64748b" fontStyle="italic">x</SvgText>
      <SvgText x={ox + 4} y={GRID_PAD - 14} textAnchor="start" fontSize="12" fontWeight="bold" fill="#64748b" fontStyle="italic">y</SvgText>

      {/* Pre-placed points */}
      {prePlacedPoints.map((pt, i) => {
        const px = toPixelX(pt.x, gridRange, cellSize);
        const py = toPixelY(pt.y, gridRange, cellSize);
        const fill = POINT_COLORS[pt.color] ?? '#a78bfa';
        return (
          <G key={`pp${i}`}>
            <Circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={DOT_R} fill={fill} stroke={fill} strokeWidth="2" />
            {pt.label && (
              <SvgText x={(px + 11).toFixed(1)} y={(py - 7).toFixed(1)}
                textAnchor="start" fontSize="11" fontWeight="bold" fill={fill}>
                {pt.label}
              </SvgText>
            )}
          </G>
        );
      })}

      {/* Ghost point (student dragging) */}
      {ghostPoint && (() => {
        const px = toPixelX(ghostPoint.x, gridRange, cellSize);
        const py = toPixelY(ghostPoint.y, gridRange, cellSize);
        const fill = POINT_COLORS[ghostPoint.color] ?? '#7c3aed';
        const lblW = 76;
        const lblH = 20;
        const lx = (px + 18 + lblW > W - 4) ? px - 18 - lblW : px + 18;
        const ly = Math.max(GRID_PAD + 2, py - 14);
        return (
          <G key="ghost">
            <Circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={DOT_GHOST_R}
              fill={fill} stroke="#a78bfa" strokeWidth="2.5" opacity="0.95" />
            {ghostPoint.label && (
              <SvgText x={(px + 13).toFixed(1)} y={(py - 8).toFixed(1)}
                textAnchor="start" fontSize="11" fontWeight="bold" fill="#a78bfa">
                {ghostPoint.label}
              </SvgText>
            )}
            {showCoordLabel && (
              <G key="clbl">
                <Rect x={lx} y={ly} width={lblW} height={lblH} rx={5}
                  fill="rgba(15,23,42,0.92)" stroke="#6d28d9" strokeWidth="1" />
                <SvgText x={(lx + lblW / 2).toFixed(1)} y={(ly + 13.5).toFixed(1)}
                  textAnchor="middle" fontSize="10" fontWeight="700" fill="#c4b5fd">
                  {`x: ${ghostPoint.x}  y: ${ghostPoint.y}`}
                </SvgText>
              </G>
            )}
          </G>
        );
      })()}

      {/* Submitted points (color-coded correct/wrong) */}
      {submittedPoints.map((pt, i) => {
        const px  = toPixelX(pt.x, gridRange, cellSize);
        const py  = toPixelY(pt.y, gridRange, cellSize);
        const fill = pt.correct === false ? '#f87171' : pt.correct === true ? '#4ade80' : (POINT_COLORS[pt.color] ?? '#7c3aed');
        return (
          <G key={`sub${i}`}>
            <Circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={DOT_R} fill={fill} stroke={fill} strokeWidth="2" />
            {pt.label && (
              <SvgText x={(px + 11).toFixed(1)} y={(py - 7).toFixed(1)}
                textAnchor="start" fontSize="11" fontWeight="bold" fill={fill}>
                {pt.label}
              </SvgText>
            )}
          </G>
        );
      })}
    </>
  );
}

// ── usePlotResponder — shared PanResponder for placement modes ─
// Returns: { panHandlers, snapPoint, placed, resetPlaced }
function usePlotResponder({ cellSize, gridRange, onSnap, setScrollEnabled, locked }) {
  const startRef   = useRef(null);
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
      startRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
      const gx = clampGrid(toGridX(e.nativeEvent.locationX, gridRange, cellSize), gridRange);
      const gy = clampGrid(toGridY(e.nativeEvent.locationY, gridRange, cellSize), gridRange);
      Haptics.selectionAsync();
      onSnap(gx, gy);
    },
    onPanResponderMove: (_, gs) => {
      if (lockedRef.current || !startRef.current) return;
      const rawX = startRef.current.x + gs.dx;
      const rawY = startRef.current.y + gs.dy;
      const gx   = clampGrid(toGridX(rawX, gridRange, cellSize), gridRange);
      const gy   = clampGrid(toGridY(rawY, gridRange, cellSize), gridRange);
      onSnap(gx, gy);
    },
    onPanResponderRelease:   () => setScrollEnabled?.(true),
    onPanResponderTerminate: () => setScrollEnabled?.(true),
  })).current;

  return panResponder;
}

// ── MCOptions — shared multiple-choice ───────────────────────
function MCOptions({ options, correctIndex, onResolve, styles }) {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  function pick(idx) {
    if (feedback) return;
    setSelected(idx);
    const ok = idx === correctIndex;
    setFeedback(ok ? 'correct' : 'wrong');
    Haptics.notificationAsync(ok
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), 1600);
  }

  return (
    <View style={{ gap: 9, marginTop: 14 }}>
      {options.map((opt, idx) => {
        const isSelected = selected === idx;
        const isCorrect  = !!feedback && idx === correctIndex;
        const isWrong    = !!feedback && isSelected && !isCorrect;
        return (
          <TouchableOpacity
            key={idx}
            style={[
              cgLocal.mcBtn,
              isCorrect ? cgLocal.mcBtnCorrect :
              isWrong   ? cgLocal.mcBtnWrong   :
              isSelected ? cgLocal.mcBtnSelected : null,
            ]}
            onPress={() => pick(idx)} disabled={!!feedback} activeOpacity={0.8}
          >
            <Text style={cgLocal.mcBtnText}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
      {feedback && (
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          {feedback === 'correct'
            ? <Text style={styles.fillInCorrectMsg}>Correct! 🎯</Text>
            : <Text style={styles.fillInRevealLabel}>
                Not quite — the answer is <Text style={{ fontWeight: '800' }}>{options[correctIndex]}</Text>.
              </Text>
          }
        </View>
      )}
    </View>
  );
}

// ── StepperRow — single axis +/- stepper ─────────────────────
function StepperRow({ label, value, onDec, onInc, disabled }) {
  return (
    <View style={cgLocal.stepperRow}>
      <Text style={cgLocal.stepperLabel}>{label}</Text>
      <TouchableOpacity style={cgLocal.stepperBtn} onPress={onDec} disabled={disabled} activeOpacity={0.7}>
        <Text style={cgLocal.stepperBtnText}>−</Text>
      </TouchableOpacity>
      <View style={cgLocal.stepperValueBox}>
        <Text style={cgLocal.stepperValue}>{value}</Text>
      </View>
      <TouchableOpacity style={cgLocal.stepperBtn} onPress={onInc} disabled={disabled} activeOpacity={0.7}>
        <Text style={cgLocal.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── XYSteppers — x and y axis pickers ────────────────────────
function XYSteppers({ gridRange, onCheck, disabled, initX = 0, initY = 0 }) {
  const [xVal, setXVal] = useState(initX);
  const [yVal, setYVal] = useState(initY);
  const clamp = (v) => Math.max(-gridRange, Math.min(gridRange, v));

  return (
    <View style={cgLocal.stepperContainer}>
      <StepperRow label="x" value={xVal}
        onDec={() => setXVal(clamp(xVal - 1))}
        onInc={() => setXVal(clamp(xVal + 1))}
        disabled={disabled} />
      <StepperRow label="y" value={yVal}
        onDec={() => setYVal(clamp(yVal - 1))}
        onInc={() => setYVal(clamp(yVal + 1))}
        disabled={disabled} />
      {!disabled && (
        <TouchableOpacity style={cgLocal.checkBtn} onPress={() => onCheck(xVal, yVal)} activeOpacity={0.8}>
          <Text style={cgLocal.checkBtnText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── GridWithTouch — grid + transparent touch overlay ─────────
function GridWithTouch({ W, cellSize, gridRange, panHandlers, svgProps = {}, children }) {
  return (
    <View style={{ width: W, height: W, alignSelf: 'center' }}>
      <Svg width={W} height={W} pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0 }} {...svgProps}>
        {children}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: W, height: W, zIndex: 2 }}
        {...panHandlers} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 1 — PlotMode
// Student taps/drags to place a single point. Submit required.
// ═══════════════════════════════════════════════════════════════
function PlotMode({ q, onResolve, styles, setScrollEnabled }) {
  const geo       = q.geometry ?? {};
  const gridRange = geo.gridRange ?? 5;
  const { W, cellSize } = useGridLayout(gridRange);
  const target    = geo.target ?? [0, 0];
  const [tx, ty]  = Array.isArray(target) ? target : [target.x ?? 0, target.y ?? 0];

  const [ghost,    setGhost]    = useState(null);
  const [feedback, setFeedback] = useState(null);
  const shakeAnim  = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  const panResponder = usePlotResponder({
    cellSize, gridRange,
    onSnap: (gx, gy) => { if (!feedback) setGhost({ x: gx, y: gy }); },
    setScrollEnabled,
    locked: !!feedback,
  });

  function handleSubmit() {
    if (!ghost || feedback) return;
    const ok = ghost.x === tx && ghost.y === ty;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else  { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(ok), 2200);
  }

  const submittedPts = feedback && ghost
    ? [{ ...ghost, color: null, correct: feedback === 'correct' }]
    : [];
  const ghostToShow = !feedback ? ghost : null;

  // Show correct answer ghost if wrong
  const correctGhost = feedback === 'wrong' ? { x: tx, y: ty, color: 'green', label: null } : null;
  const prePlaced = correctGhost ? [correctGhost] : [];

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={cgLocal.targetBadge}>
        <Text style={cgLocal.targetLabel}>Plot the point</Text>
        <Text style={cgLocal.targetValue}>({tx}, {ty})</Text>
      </View>

      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <GridWithTouch W={W} cellSize={cellSize} gridRange={gridRange} panHandlers={panResponder.panHandlers}>
          <GridSvgContent W={W} cellSize={cellSize} gridRange={gridRange}
            prePlacedPoints={prePlaced}
            ghostPoint={ghostToShow ? { ...ghostToShow, color: 'purple' } : null}
            submittedPoints={submittedPts}
            showCoordLabel={!feedback}
          />
        </GridWithTouch>
      </Animated.View>

      {!ghost && !feedback && <Text style={cgLocal.placeHint}>Tap the grid to place the point</Text>}
      {ghost && !feedback && (
        <Text style={cgLocal.placeHint}>
          Tap Check when ready
        </Text>
      )}
      {feedback === 'correct' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInCorrectMsg}>Correct! 🎯</Text>
          <Text style={cgLocal.feedbackSub}>({tx}, {ty}) is the right spot.</Text>
        </View>
      )}
      {feedback === 'wrong' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInRevealLabel}>
            Not quite — you placed ({ghost?.x}, {ghost?.y}).
          </Text>
          <Text style={styles.fillInRevealAnswer}>Answer: ({tx}, {ty})</Text>
        </View>
      )}
      {!feedback && (
        <TouchableOpacity
          style={[cgLocal.checkBtn, !ghost && cgLocal.checkBtnDisabled]}
          onPress={handleSubmit} disabled={!ghost} activeOpacity={0.8}
        >
          <Text style={cgLocal.checkBtnText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 2 — ReadMode
// Pre-placed colored point; student uses x/y steppers to name coords.
// ═══════════════════════════════════════════════════════════════
function ReadMode({ q, onResolve, styles }) {
  const geo       = q.geometry ?? {};
  const gridRange = geo.gridRange ?? 5;
  const { W, cellSize } = useGridLayout(gridRange);
  const pts       = Array.isArray(geo.points) ? geo.points : [];

  // The correct answer is simply the first point's coordinates
  const correctX  = pts[0]?.x ?? (geo.correctX ?? 0);
  const correctY  = pts[0]?.y ?? (geo.correctY ?? 0);

  const [feedback,  setFeedback]  = useState(null);
  const [submitted, setSubmitted] = useState(null);

  function handleCheck(xVal, yVal) {
    const ok = xVal === correctX && yVal === correctY;
    setSubmitted({ x: xVal, y: yVal });
    setFeedback(ok ? 'correct' : 'wrong');
    Haptics.notificationAsync(ok
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), 2200);
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={W} height={W} style={{ alignSelf: 'center' }}>
        <GridSvgContent W={W} cellSize={cellSize} gridRange={gridRange}
          prePlacedPoints={pts}
          showQuadrantTints={false}
        />
      </Svg>
      <Text style={cgLocal.readPrompt}>What are the coordinates of the point?</Text>
      <XYSteppers gridRange={gridRange} onCheck={handleCheck} disabled={!!feedback} />
      {feedback === 'correct' && (
        <Text style={[styles.fillInCorrectMsg, { marginTop: 8 }]}>
          Correct! ({correctX}, {correctY}) 🎯
        </Text>
      )}
      {feedback === 'wrong' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInRevealLabel}>
            Not quite — you entered ({submitted?.x}, {submitted?.y}).
          </Text>
          <Text style={styles.fillInRevealAnswer}>Answer: ({correctX}, {correctY})</Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 3 — MultiPlotMode
// Student plots multiple labeled points sequentially.
// ═══════════════════════════════════════════════════════════════
function MultiPlotMode({ q, onResolve, styles, setScrollEnabled }) {
  const geo       = q.geometry ?? {};
  const gridRange = geo.gridRange ?? 5;
  const { W, cellSize } = useGridLayout(gridRange);
  const targets   = Array.isArray(geo.targets) ? geo.targets : [];

  const [placed,    setPlaced]    = useState({});   // { label: {x,y} }
  const [activeIdx, setActiveIdx] = useState(0);
  const [feedback,  setFeedback]  = useState(null);

  const activeTarget = targets[activeIdx] ?? null;
  const activeColor  = activeTarget ? (activeTarget.color ?? COLOR_ORDER[activeIdx % COLOR_ORDER.length]) : 'purple';

  const [ghostXY, setGhostXY] = useState(null);

  const panResponder = usePlotResponder({
    cellSize, gridRange,
    onSnap: (gx, gy) => {
      if (feedback || !activeTarget) return;
      setGhostXY({ x: gx, y: gy });
    },
    setScrollEnabled,
    locked: !!feedback || !activeTarget,
  });

  function handleTapConfirm() {
    if (!ghostXY || !activeTarget || feedback) return;
    const newPlaced = { ...placed, [activeTarget.label]: { x: ghostXY.x, y: ghostXY.y } };
    setPlaced(newPlaced);
    setGhostXY(null);
    Haptics.selectionAsync();
    const nextIdx = activeIdx + 1;
    if (nextIdx < targets.length) {
      setActiveIdx(nextIdx);
    }
  }

  function handleSubmit() {
    if (feedback) return;
    const allPlaced = targets.every(t => placed[t.label] !== undefined);
    if (!allPlaced) return;
    const allCorrect = targets.every(t => {
      const p = placed[t.label];
      return p && p.x === t.x && p.y === t.y;
    });
    setFeedback(allCorrect ? 'correct' : 'wrong');
    if (allCorrect) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(allCorrect), 2200);
  }

  const allPlaced = targets.every(t => placed[t.label] !== undefined);

  // Build submitted points for display
  const submittedPts = feedback
    ? targets.map(t => {
        const p = placed[t.label];
        const correct = p && p.x === t.x && p.y === t.y;
        return { x: p?.x ?? t.x, y: p?.y ?? t.y, label: t.label, color: t.color ?? COLOR_ORDER[targets.indexOf(t) % COLOR_ORDER.length], correct };
      })
    : [];

  // Pre-placed (already confirmed points before submit)
  const confirmedPoints = !feedback
    ? targets
        .filter(t => placed[t.label])
        .map(t => ({
          x: placed[t.label].x, y: placed[t.label].y,
          label: t.label,
          color: t.color ?? COLOR_ORDER[targets.indexOf(t) % COLOR_ORDER.length],
        }))
    : [];

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Point legend */}
      <View style={cgLocal.legend}>
        {targets.map((t, idx) => {
          const color = POINT_COLORS[t.color ?? COLOR_ORDER[idx % COLOR_ORDER.length]] ?? '#a78bfa';
          const isActive  = idx === activeIdx && !feedback;
          const isPlaced  = !!placed[t.label];
          return (
            <View key={t.label} style={[cgLocal.legendItem, isActive && cgLocal.legendItemActive]}>
              <View style={[cgLocal.legendDot, { backgroundColor: color }]} />
              <Text style={[cgLocal.legendText, isPlaced && cgLocal.legendTextDone]}>
                {t.label} ({t.x}, {t.y})
              </Text>
              {isPlaced && !feedback && <Text style={cgLocal.legendCheck}>✓</Text>}
            </View>
          );
        })}
      </View>

      <GridWithTouch W={W} cellSize={cellSize} gridRange={gridRange} panHandlers={panResponder.panHandlers}>
        <GridSvgContent W={W} cellSize={cellSize} gridRange={gridRange}
          prePlacedPoints={confirmedPoints}
          ghostPoint={ghostXY && activeTarget && !feedback
            ? { ...ghostXY, color: activeColor, label: activeTarget.label }
            : null}
          submittedPoints={submittedPts}
        />
      </GridWithTouch>

      {!feedback && ghostXY && activeTarget && (
        <TouchableOpacity style={cgLocal.confirmBtn} onPress={handleTapConfirm} activeOpacity={0.8}>
          <Text style={cgLocal.confirmBtnText}>Place {activeTarget.label} here ({ghostXY.x}, {ghostXY.y})</Text>
        </TouchableOpacity>
      )}

      {!feedback && !ghostXY && activeTarget && (
        <Text style={cgLocal.placeHint}>Tap the grid to place point {activeTarget.label}</Text>
      )}
      {!feedback && !activeTarget && allPlaced && (
        <Text style={cgLocal.placeHint}>All points placed — tap Check Answer</Text>
      )}

      {feedback === 'correct' && <Text style={[styles.fillInCorrectMsg, { marginTop: 10 }]}>All points correct! 🎯</Text>}
      {feedback === 'wrong' && (
        <Text style={[styles.fillInRevealLabel, { marginTop: 10 }]}>
          Some points were off — the correct positions are shown in green.
        </Text>
      )}

      {!feedback && allPlaced && (
        <TouchableOpacity style={cgLocal.checkBtn} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={cgLocal.checkBtnText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 4 — MissingMode
// Some points pre-shown; student plots the missing one.
// ═══════════════════════════════════════════════════════════════
function MissingMode({ q, onResolve, styles, setScrollEnabled }) {
  const geo         = q.geometry ?? {};
  const gridRange   = geo.gridRange ?? 5;
  const { W, cellSize } = useGridLayout(gridRange);
  const shownPoints = Array.isArray(geo.shownPoints) ? geo.shownPoints : [];
  const tgt         = geo.target ?? {};
  const [tx, ty]    = [tgt.x ?? 0, tgt.y ?? 0];
  const tLabel      = tgt.label ?? 'D';

  const [ghost,    setGhost]    = useState(null);
  const [feedback, setFeedback] = useState(null);
  const shakeAnim  = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  const panResponder = usePlotResponder({
    cellSize, gridRange,
    onSnap: (gx, gy) => { if (!feedback) setGhost({ x: gx, y: gy }); },
    setScrollEnabled,
    locked: !!feedback,
  });

  function handleSubmit() {
    if (!ghost || feedback) return;
    const ok = ghost.x === tx && ghost.y === ty;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else  { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(ok), 2200);
  }

  const submittedPts = feedback && ghost
    ? [{ ...ghost, label: tLabel, color: null, correct: feedback === 'correct' }]
    : [];
  const correctGhost = feedback === 'wrong' ? { x: tx, y: ty, color: 'green', label: tLabel } : null;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={cgLocal.targetBadge}>
        <Text style={cgLocal.targetLabel}>Plot point {tLabel} at</Text>
        <Text style={cgLocal.targetValue}>({tx}, {ty})</Text>
      </View>

      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <GridWithTouch W={W} cellSize={cellSize} gridRange={gridRange} panHandlers={panResponder.panHandlers}>
          <GridSvgContent W={W} cellSize={cellSize} gridRange={gridRange}
            prePlacedPoints={[...shownPoints, ...(correctGhost ? [correctGhost] : [])]}
            ghostPoint={!feedback && ghost ? { ...ghost, color: 'purple', label: tLabel } : null}
            submittedPoints={submittedPts}
            showCoordLabel={!feedback}
          />
        </GridWithTouch>
      </Animated.View>

      {!ghost && !feedback && <Text style={cgLocal.placeHint}>Tap the grid to place point {tLabel}</Text>}
      {ghost && !feedback && <Text style={cgLocal.placeHint}>Point {tLabel} at ({ghost.x}, {ghost.y}) — tap Check when ready</Text>}
      {feedback === 'correct' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInCorrectMsg}>Correct! 🎯</Text>
          <Text style={cgLocal.feedbackSub}>Point {tLabel} at ({tx}, {ty}) is correct.</Text>
        </View>
      )}
      {feedback === 'wrong' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInRevealLabel}>Not quite — you placed ({ghost?.x}, {ghost?.y}).</Text>
          <Text style={styles.fillInRevealAnswer}>Answer: ({tx}, {ty})</Text>
        </View>
      )}
      {!feedback && (
        <TouchableOpacity
          style={[cgLocal.checkBtn, !ghost && cgLocal.checkBtnDisabled]}
          onPress={handleSubmit} disabled={!ghost} activeOpacity={0.8}
        >
          <Text style={cgLocal.checkBtnText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 5 — QuadrantMode
// Pre-placed point; student picks which quadrant from MC.
// ═══════════════════════════════════════════════════════════════
function QuadrantMode({ q, onResolve, styles }) {
  const geo       = q.geometry ?? {};
  const gridRange = geo.gridRange ?? 5;
  const { W, cellSize } = useGridLayout(gridRange);
  const pts       = Array.isArray(geo.points) ? geo.points : [];
  const options   = Array.isArray(q.options) ? q.options : [];
  const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  const [revealQ, setRevealQ] = useState(null);

  // After answer, highlight the correct quadrant
  function handleResolve(ok) {
    const correctLabel = options[correctIndex] ?? '';
    const qMap = {
      'Quadrant I': 'I', 'Quadrant II': 'II',
      'Quadrant III': 'III', 'Quadrant IV': 'IV',
    };
    setRevealQ(qMap[correctLabel] ?? null);
    setTimeout(() => onResolve(ok), 1600);
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={W} height={W} style={{ alignSelf: 'center' }}>
        <GridSvgContent W={W} cellSize={cellSize} gridRange={gridRange}
          prePlacedPoints={pts}
          showQuadrantTints={true}
          revealQuadrant={revealQ}
        />
      </Svg>
      <MCOptions options={options} correctIndex={correctIndex}
        onResolve={handleResolve} styles={styles} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 6 — ErrorDetectMode
// A point is shown. A named character claims wrong coordinates.
// Step 1: Is the claim right or wrong?
// Step 2 (if wrong & student correct): Enter the actual coordinates.
// ═══════════════════════════════════════════════════════════════
function ErrorDetectMode({ q, onResolve, styles }) {
  const geo       = q.geometry ?? {};
  const gridRange = geo.gridRange ?? 5;
  const { W, cellSize } = useGridLayout(gridRange);
  const pts       = Array.isArray(geo.points) ? geo.points : [];
  const claim     = geo.claim ?? {};
  const claimName = claim.name ?? 'Sam';
  const claimX    = typeof claim.x === 'number' ? claim.x : 0;
  const claimY    = typeof claim.y === 'number' ? claim.y : 0;
  const correctX  = geo.correctX ?? (pts[0]?.x ?? 0);
  const correctY  = geo.correctY ?? (pts[0]?.y ?? 0);
  const claimIsWrong = (claimX !== correctX) || (claimY !== correctY);

  const [step,     setStep]     = useState(1);
  const [feedback, setFeedback] = useState(null);

  function handleJudgement(sayingWrong) {
    const judgementCorrect = sayingWrong === claimIsWrong;
    if (judgementCorrect && claimIsWrong) {
      Haptics.selectionAsync();
      setStep(2);
    } else if (judgementCorrect && !claimIsWrong) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedback('correct');
      setTimeout(() => onResolve(true), 2000);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback('wrong_judge');
      setTimeout(() => onResolve(false), 2200);
    }
  }

  function handleCoordCheck(xVal, yVal) {
    const ok = xVal === correctX && yVal === correctY;
    setFeedback(ok ? 'correct' : 'wrong_coords');
    Haptics.notificationAsync(ok
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), 2200);
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={cgLocal.claimBadge}>
        <Text style={cgLocal.claimText}>
          {claimName} says this point is{' '}
          <Text style={cgLocal.claimCoord}>({claimX}, {claimY})</Text>
        </Text>
      </View>

      <Svg width={W} height={W} style={{ alignSelf: 'center' }}>
        <GridSvgContent W={W} cellSize={cellSize} gridRange={gridRange}
          prePlacedPoints={pts}
          showQuadrantTints={false}
        />
      </Svg>

      {step === 1 && !feedback && (
        <View style={cgLocal.judgeRow}>
          <TouchableOpacity style={[cgLocal.judgeBtn, cgLocal.judgeBtnYes]}
            onPress={() => handleJudgement(false)} activeOpacity={0.8}>
            <Text style={cgLocal.judgeBtnText}>✓  {claimName} is right</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cgLocal.judgeBtn, cgLocal.judgeBtnNo]}
            onPress={() => handleJudgement(true)} activeOpacity={0.8}>
            <Text style={cgLocal.judgeBtnText}>✗  {claimName} is wrong</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && !feedback && (
        <View style={{ width: '100%', alignItems: 'center' }}>
          <Text style={cgLocal.readPrompt}>Good catch! What are the correct coordinates?</Text>
          <XYSteppers gridRange={gridRange} onCheck={handleCoordCheck} disabled={false} />
        </View>
      )}

      {feedback === 'correct' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInCorrectMsg}>Correct! 🎯</Text>
          <Text style={cgLocal.feedbackSub}>
            The point is ({correctX}, {correctY}) — {claimName} had x and y swapped.
          </Text>
        </View>
      )}
      {feedback === 'wrong_judge' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInRevealLabel}>{claimName} was actually wrong!</Text>
          <Text style={styles.fillInRevealAnswer}>The point is ({correctX}, {correctY}).</Text>
        </View>
      )}
      {feedback === 'wrong_coords' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInRevealLabel}>Not quite!</Text>
          <Text style={styles.fillInRevealAnswer}>The point is ({correctX}, {correctY}).</Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// CoordinateGridRenderer — dispatcher
// ═══════════════════════════════════════════════════════════════
export default function CoordinateGridRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const mode = (q.geometry?.mode ?? q.mode ?? 'plot').toLowerCase();
  if (mode === 'read')         return <ReadMode         q={q} onResolve={onResolve} styles={styles} />;
  if (mode === 'multi_plot')   return <MultiPlotMode    q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
  if (mode === 'missing')      return <MissingMode      q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
  if (mode === 'quadrant')     return <QuadrantMode     q={q} onResolve={onResolve} styles={styles} />;
  if (mode === 'error_detect') return <ErrorDetectMode  q={q} onResolve={onResolve} styles={styles} />;
  return <PlotMode q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
}

// ── Local styles ──────────────────────────────────────────────
const cgLocal = StyleSheet.create({
  targetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12,
  },
  targetLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  targetValue: { fontSize: 22, fontWeight: '900', color: '#a78bfa' },

  placeHint: {
    fontSize: 12, color: '#475569', textAlign: 'center',
    marginTop: 8, fontStyle: 'italic',
  },
  feedbackSub: {
    fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center',
  },

  checkBtn: {
    marginTop: 16, backgroundColor: '#16a34a', borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 36, alignItems: 'center',
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  checkBtnDisabled: {
    backgroundColor: '#1e3a2f', shadowOpacity: 0,
    borderWidth: 1, borderColor: '#334155',
  },
  checkBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  confirmBtn: {
    marginTop: 10, backgroundColor: '#1d4ed8', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center',
    borderWidth: 1, borderColor: '#3b82f6',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#e2e8f0' },

  // Multi-plot legend
  legend: {
    width: '100%', marginBottom: 10, gap: 6,
  },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#1e3a5f',
    backgroundColor: '#0f172a',
  },
  legendItemActive: {
    borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)',
  },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  legendTextDone: { color: '#e2e8f0' },
  legendCheck: { fontSize: 14, color: '#4ade80' },

  // MC buttons
  mcBtn: {
    paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#334155',
    backgroundColor: '#1e3a5f', alignItems: 'center',
  },
  mcBtnSelected: { backgroundColor: '#1d4ed8', borderColor: '#60a5fa' },
  mcBtnCorrect:  { backgroundColor: '#166534', borderColor: '#4ade80' },
  mcBtnWrong:    { backgroundColor: '#7f1d1d', borderColor: '#f87171' },
  mcBtnText:     { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },

  // Read mode prompt
  readPrompt: {
    fontSize: 14, fontWeight: '600', color: '#94a3b8',
    textAlign: 'center', marginTop: 10, marginBottom: 4,
  },

  // X/Y Steppers
  stepperContainer: { width: '100%', gap: 10, marginTop: 10 },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 4,
  },
  stepperLabel: {
    width: 16, fontSize: 15, fontWeight: '800',
    color: '#a78bfa', fontStyle: 'italic', textAlign: 'center',
  },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1e3a5f', borderWidth: 1.5, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 22, fontWeight: '700', color: '#e2e8f0', lineHeight: 26 },
  stepperValueBox: {
    flex: 1, height: 44, borderRadius: 12,
    backgroundColor: '#0f172a', borderWidth: 1.5, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: { fontSize: 20, fontWeight: '800', color: '#e2e8f0' },

  // Error detect mode
  claimBadge: {
    width: '100%', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    backgroundColor: 'rgba(251,191,36,0.07)',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, alignItems: 'center',
  },
  claimText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  claimCoord: { fontSize: 16, fontWeight: '900', color: '#fbbf24' },
  judgeRow: { flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' },
  judgeBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', borderWidth: 1.5,
  },
  judgeBtnYes: { backgroundColor: '#14532d', borderColor: '#4ade80' },
  judgeBtnNo:  { backgroundColor: '#7f1d1d', borderColor: '#f87171' },
  judgeBtnText: { fontSize: 15, fontWeight: '800', color: '#e2e8f0' },
});
