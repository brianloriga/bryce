import React, { useState, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { measStyles, nlStyles, NL_W, NL_PAD, NL_USABLE } from '../shared/measurementStyles';

// ── Layout constants ───────────────────────────────────────────
const DOT_SIZE     = 24;
const LINE_TOP     = 32;      // vertical center of the line within the container
const DOT_TOP      = LINE_TOP - DOT_SIZE / 2;
const TICK_TOP     = LINE_TOP - 6;
const TICK_H       = 12;
const LABEL_TOP    = LINE_TOP + 8;
const TOUCH_SIZE   = 40;      // tappable area per tick

// ── Helpers ────────────────────────────────────────────────────
function formatFrac(num, den) {
  if (num === 0)   return '0';
  if (num === den) return '1';
  return `${num}/${den}`;
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tick x-coordinate (left edge, tick is 1.5px wide)
function tickX(i, denominator) {
  return NL_PAD + (i / denominator) * NL_USABLE;
}

// Dot left offset (centered on the tick)
function dotLeft(i, denominator) {
  return tickX(i, denominator) - DOT_SIZE / 2;
}

// ── MC option generation for read mode ────────────────────────
// Cross-denom distractors + same-denom neighbors, same strategy as FractionBarRenderer.
function buildNLOptions(denominator, target) {
  const correct = formatFrac(target, denominator);
  const seen    = new Set([correct]);
  const pool    = [];

  // Same-denominator neighbors (adjacent ticks)
  const sameDenomCands = shuffleArr(
    Array.from({ length: denominator + 1 }, (_, i) => i)
      .filter(i => i !== target)
      .map(i => formatFrac(i, denominator)),
  );
  for (const f of sameDenomCands) {
    if (pool.length >= 2) break;
    if (!seen.has(f)) { seen.add(f); pool.push(f); }
  }

  // Cross-denominator: same target numerator, adjacent denominator
  if (target > 0 && target < denominator) {
    const adjDens = shuffleArr(
      [denominator - 1, denominator + 1, denominator + 2]
        .filter(d => d >= 2 && d <= 12 && d !== denominator && target < d),
    );
    for (const d of adjDens) {
      if (pool.length >= 3) break;
      const f = formatFrac(target, d);
      if (!seen.has(f)) { seen.add(f); pool.push(f); }
    }
  }

  // Common-fraction fallback
  const commons = shuffleArr(['1/2', '1/3', '2/3', '1/4', '3/4', '2/5', '3/5',
    '1/6', '5/6', '1/8', '3/8', '5/8', '0', '1']);
  for (const f of commons) {
    if (pool.length >= 3) break;
    if (!seen.has(f)) { seen.add(f); pool.push(f); }
  }

  return { options: shuffleArr([correct, ...pool.slice(0, 3)]), correct };
}

// ── NumberLine — shared visual component ───────────────────────
// markedAt: tick index to show the pre-placed dot (read mode); null = no dot until tapped
// selected: currently tapped tick (place mode)
// onTickTap: called with tick index when a tick is tapped (place mode)
// showAllLabels: show fraction labels at every tick (place mode) vs endpoints only (read mode)
function NumberLine({
  denominator, markedAt = null, selected = null, onTickTap,
  showAllLabels = false, feedback, correctTick = null,
}) {
  const ticks = Array.from({ length: denominator + 1 }, (_, i) => i);

  // Which tick gets the dot?
  const dotTick = selected !== null ? selected : markedAt;

  // Dot color
  const dotColor = (() => {
    if (feedback === 'correct') return '#22c55e';
    if (feedback === 'wrong')   return '#ef4444';
    if (markedAt !== null)      return '#a78bfa'; // pre-placed (read mode)
    return '#4ade80';                              // student-placed (place mode)
  })();

  return (
    <View style={[nlStyles.container, { height: 68, width: NL_W, alignSelf: 'center' }]}>
      {/* Horizontal line */}
      <View style={[nlStyles.line, { top: LINE_TOP }]} />

      {/* Ticks + labels + touch targets */}
      {ticks.map((i) => {
        const x    = tickX(i, denominator);
        const isEnd = i === 0 || i === denominator;
        const label = showAllLabels || isEnd ? formatFrac(i, denominator) : null;

        return (
          <TouchableOpacity
            key={i}
            disabled={!onTickTap || !!feedback}
            onPress={() => onTickTap?.(i)}
            style={{
              position: 'absolute',
              left: x - TOUCH_SIZE / 2,
              top:  LINE_TOP - TOUCH_SIZE / 2,
              width: TOUCH_SIZE,
              height: TOUCH_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            {/* Tick mark */}
            <View
              style={{
                position: 'absolute',
                left: TOUCH_SIZE / 2 - 0.75,
                top:  TOUCH_SIZE / 2 - TICK_H / 2,
                width: 1.5,
                height: TICK_H,
                backgroundColor: isEnd ? '#94a3b8' : '#475569',
              }}
            />
            {/* Label */}
            {label && (
              <Text
                style={{
                  position: 'absolute',
                  top:  TOUCH_SIZE / 2 + TICK_H / 2 + 2,
                  left: TOUCH_SIZE / 2 - 20,
                  width: 40,
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: '700',
                  color: isEnd ? '#94a3b8' : '#64748b',
                }}
              >
                {label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Dot — rendered on top of everything */}
      {dotTick !== null && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left:  dotLeft(dotTick, denominator),
            top:   DOT_TOP,
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: dotColor,
            borderWidth: 2.5,
            borderColor: feedback === 'correct' ? '#86efac' : feedback === 'wrong' ? '#fca5a5' : '#e2e8f0',
            zIndex: 3,
          }}
        />
      )}

      {/* Arrow below dot pointing to position (read mode) */}
      {markedAt !== null && !showAllLabels && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: tickX(markedAt, denominator) - 1,
            top:  LINE_TOP + 2,
            width: 2,
            height: 10,
            backgroundColor: '#a78bfa',
            zIndex: 3,
          }}
        />
      )}
    </View>
  );
}

// ── ReadMode ───────────────────────────────────────────────────
// A point is pre-placed on the line. Student picks the fraction from 4 MC options.
// Only "0" and "1" are labelled — student must count the tick intervals.
function ReadMode({ q, onResolve }) {
  const geo         = q.geometry ?? {};
  const denominator = Number(geo.denominator ?? 4);
  const target      = Number(geo.target      ?? 3); // tick index

  const { options, correct } = useMemo(
    () => buildNLOptions(denominator, target),
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
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1600);
  }

  return (
    <View style={nlrStyles.modeWrap}>
      <Text style={nlrStyles.instruction}>
        What fraction does the point show?
      </Text>

      <NumberLine
        denominator={denominator}
        markedAt={target}
        feedback={feedback}
        showAllLabels={false}
      />

      <Text style={nlrStyles.subHint}>
        Count the equal spaces between 0 and 1.
      </Text>

      <View style={measStyles.estimateGrid}>
        {options.map((opt) => {
          const isChosen  = chosen === opt;
          const isCorrect = !!feedback && opt === correct;
          const isWrong   = !!feedback && isChosen && opt !== correct;
          const isDimmed  = !!feedback && !isChosen && opt !== correct;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                measStyles.estimateBtn,
                nlrStyles.mcBtn,
                isChosen  && measStyles.estimateBtnChosen,
                isCorrect && measStyles.estimateBtnCorrect,
                isWrong   && measStyles.estimateBtnWrong,
                isDimmed  && measStyles.estimateBtnDimmed,
              ]}
              onPress={() => handlePick(opt)}
              disabled={!!feedback}
            >
              <Text style={nlrStyles.mcText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedback === 'wrong' && chosen && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>
            The line is divided into {denominator} equal parts.
            {' '}Count {target} space{target !== 1 ? 's' : ''} from 0 — the point is at {correct}.
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            ✓ {target} space{target !== 1 ? 's' : ''} out of {denominator} — that{"'"}s {correct}! 🎉
          </Text>
        </View>
      )}
    </View>
  );
}

// ── PlaceMode ──────────────────────────────────────────────────
// Target fraction shown in a badge. All tick positions are labelled.
// Student taps a tick to place their answer dot, then presses Check.
function PlaceMode({ q, onResolve }) {
  const geo         = q.geometry ?? {};
  const denominator = Number(geo.denominator ?? 4);
  const target      = Number(geo.target      ?? 3); // correct tick index

  const [selected,  setSelected]  = useState(null);
  const [feedback,  setFeedback]  = useState(null);

  function handleTickTap(i) {
    if (feedback) return;
    setSelected(i);
    Haptics.selectionAsync();
  }

  function handleCheck() {
    if (feedback || selected === null) return;
    const ok = selected === target;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  const targetLabel = formatFrac(target, denominator);

  return (
    <View style={nlrStyles.modeWrap}>
      {/* Target badge */}
      <View style={nlrStyles.targetBadge}>
        <Text style={nlrStyles.targetLabel}>Place</Text>
        <Text style={nlrStyles.targetFrac}>{targetLabel}</Text>
        <Text style={nlrStyles.targetLabel}>on the line</Text>
      </View>

      <NumberLine
        denominator={denominator}
        selected={selected}
        onTickTap={handleTickTap}
        showAllLabels
        feedback={feedback}
        correctTick={target}
      />

      <Text style={nlrStyles.placeHint}>
        {selected === null
          ? 'Tap a point on the number line to place your answer.'
          : `You placed ${formatFrac(selected, denominator)} — press Check to confirm.`}
      </Text>

      {feedback === 'wrong' && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>
            {targetLabel} is {target} space{target !== 1 ? 's' : ''} from 0 out of {denominator} equal parts.
            {selected !== null && ` You tapped ${formatFrac(selected, denominator)}.`}
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            ✓ {targetLabel} is exactly {target}/{denominator} of the way from 0 to 1! 🎉
          </Text>
        </View>
      )}

      {!feedback && (
        <View style={nlrStyles.actionRow}>
          <TouchableOpacity
            style={nlrStyles.resetBtn}
            onPress={() => setSelected(null)}
          >
            <Text style={nlrStyles.resetBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[nlrStyles.checkBtn, selected === null && nlrStyles.checkBtnDisabled]}
            onPress={handleCheck}
            disabled={selected === null}
          >
            <Text style={nlrStyles.checkBtnText}>Check</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── OrderMode ──────────────────────────────────────────────────
// Three fraction chips displayed in scrambled order. Student taps them
// in ascending order (1st smallest → 3rd largest).
function OrderMode({ q, onResolve }) {
  const geo         = q.geometry ?? {};
  const denominator = Number(geo.denominator ?? 4);
  // fractions is an array of tick indices, e.g. [3, 1, 2] for 3/4, 1/4, 2/4
  const rawFractions = Array.isArray(geo.fractions) ? geo.fractions : [1, 3, 2];
  const fractions    = rawFractions.map(Number);

  // Scramble once, keep stable
  const chips = useMemo(() => shuffleArr(fractions.map(f => ({
    id:    f,
    label: formatFrac(f, denominator),
    value: f / denominator,
  }))), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [sequence,  setSequence]  = useState([]); // tap order: array of chip ids
  const [feedback,  setFeedback]  = useState(null);

  const sorted = [...fractions].sort((a, b) => a - b);

  function handleTap(id) {
    if (feedback)             return;
    if (sequence.includes(id)) {
      // Allow de-selection of the LAST tapped
      if (sequence[sequence.length - 1] === id) {
        setSequence(prev => prev.slice(0, -1));
      }
      return;
    }
    const next = [...sequence, id];
    setSequence(next);
    Haptics.selectionAsync();

    if (next.length === fractions.length) {
      const ok = next.every((id, i) => id === sorted[i]);
      setFeedback(ok ? 'correct' : 'wrong');
      if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => onResolve(ok), ok ? 900 : 1800);
    }
  }

  const sortedLabels = sorted.map(f => formatFrac(f, denominator)).join(' < ');

  return (
    <View style={nlrStyles.modeWrap}>
      <Text style={nlrStyles.instruction}>Tap the fractions in order from smallest to largest.</Text>

      {/* Number line showing all three points */}
      <NumberLine
        denominator={denominator}
        showAllLabels
      />

      {/* Chip row */}
      <View style={nlrStyles.chipRow}>
        {chips.map((chip) => {
          const tapPos = sequence.indexOf(chip.id);
          const isTapped = tapPos !== -1;
          const ok = feedback === 'correct';
          const isWrong = feedback === 'wrong' && isTapped && chip.id !== sorted[tapPos];
          return (
            <TouchableOpacity
              key={chip.id}
              style={[
                nlrStyles.chip,
                isTapped  && nlrStyles.chipTapped,
                ok        && isTapped && nlrStyles.chipCorrect,
                isWrong   && nlrStyles.chipWrong,
              ]}
              onPress={() => handleTap(chip.id)}
              disabled={!!feedback}
            >
              <Text style={[nlrStyles.chipText, isTapped && nlrStyles.chipTextTapped]}>
                {chip.label}
              </Text>
              {isTapped && (
                <View style={nlrStyles.chipBadge}>
                  <Text style={nlrStyles.chipBadgeText}>{tapPos + 1}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={nlrStyles.orderHint}>
        {sequence.length === 0
          ? 'Tap the smallest fraction first.'
          : sequence.length < fractions.length
          ? `${fractions.length - sequence.length} more to go — tap the next smallest.`
          : ''}
      </Text>

      {feedback === 'wrong' && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>
            Correct order: {sortedLabels}. Tap Reset to try again.
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            ✓ In order: {sortedLabels} 🎉
          </Text>
        </View>
      )}

      {!feedback && sequence.length > 0 && (
        <TouchableOpacity style={nlrStyles.resetBtn} onPress={() => setSequence([])}>
          <Text style={nlrStyles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main export ────────────────────────────────────────────────
export default function FractionNumberLineRenderer({ q, onResolve }) {
  const mode = q.geometry?.mode ?? 'read';
  if (mode === 'place') return <PlaceMode  q={q} onResolve={onResolve} />;
  if (mode === 'order') return <OrderMode  q={q} onResolve={onResolve} />;
  return                       <ReadMode   q={q} onResolve={onResolve} />;
}

// ── Styles ─────────────────────────────────────────────────────
const nlrStyles = StyleSheet.create({
  modeWrap: {
    alignItems: 'center', paddingBottom: 8,
  },
  instruction: {
    fontSize: 14, fontWeight: '600', color: '#94a3b8',
    textAlign: 'center', marginBottom: 6,
  },
  subHint: {
    fontSize: 12, color: '#475569', textAlign: 'center',
    marginTop: 2, marginBottom: 8, fontStyle: 'italic',
  },

  // Read mode MC
  mcBtn:  { paddingVertical: 20 },
  mcText: { fontSize: 22, fontWeight: '900', color: '#e2e8f0' },

  // Place mode
  targetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#a78bfa',
    paddingVertical: 8, paddingHorizontal: 16,
    marginBottom: 8,
  },
  targetLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  targetFrac:  { fontSize: 28, fontWeight: '900', color: '#a78bfa' },
  placeHint: {
    fontSize: 12, fontWeight: '600', color: '#64748b',
    textAlign: 'center', marginTop: 4, marginBottom: 10,
  },

  // Order mode chips
  chipRow: {
    flexDirection: 'row', gap: 12, justifyContent: 'center',
    marginVertical: 12,
  },
  chip: {
    minWidth: 72, paddingVertical: 18, paddingHorizontal: 12,
    borderRadius: 14, backgroundColor: '#1e293b',
    borderWidth: 2, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  chipTapped:   { backgroundColor: '#312e81', borderColor: '#818cf8' },
  chipCorrect:  { backgroundColor: '#14532d', borderColor: '#22c55e' },
  chipWrong:    { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  chipText:     { fontSize: 20, fontWeight: '900', color: '#e2e8f0' },
  chipTextTapped: { color: '#c7d2fe' },
  chipBadge: {
    position: 'absolute', top: -8, right: -8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#818cf8', alignItems: 'center', justifyContent: 'center',
  },
  chipBadgeText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  orderHint: {
    fontSize: 12, color: '#475569', textAlign: 'center',
    marginTop: 2, marginBottom: 6,
  },

  // Shared action buttons
  actionRow: {
    flexDirection: 'row', gap: 12, marginTop: 12, width: NL_W,
  },
  resetBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 2, borderColor: '#334155', alignItems: 'center',
    marginTop: 8,
  },
  resetBtnText: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  checkBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#a78bfa', alignItems: 'center',
  },
  checkBtnDisabled: { backgroundColor: '#334155', opacity: 0.5 },
  checkBtnText: { fontSize: 16, fontWeight: '800', color: '#1e0036' },
});
