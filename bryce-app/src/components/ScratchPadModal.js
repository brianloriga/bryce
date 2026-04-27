// No native modules — drawing uses PanResponder + rotated View line segments.
// Works on web, iOS, and Android without react-native-svg.
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Dimensions, PanResponder, TextInput,
  TouchableWithoutFeedback, Platform,
} from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Layout ─────────────────────────────────────────────────────
const SHEET_H  = SH * 0.60;
const CANVAS_H = SHEET_H - 96;
const MIN_DIST = 3;             // px between recorded points

// ── Line segment (rotated View) ────────────────────────────────
// Draws a straight line from (x1,y1) to (x2,y2) using a centered,
// rotated View.  Pure React Native — no SVG required.
function Segment({ x1, y1, x2, y2, color, w }) {
  const dx  = x2 - x1;
  const dy  = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return null;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const midX  = (x1 + x2) / 2;
  const midY  = (y1 + y2) / 2;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left:   midX - len / 2,
        top:    midY - w / 2,
        width:  len,
        height: w,
        backgroundColor: color,
        borderRadius: w / 2,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

// ── Stroke renderer ────────────────────────────────────────────
// Renders an array of {x, y} points as connected line segments.
function Stroke({ points, color, w }) {
  if (points.length < 2) {
    // Single tap — show a dot
    const p = points[0];
    if (!p) return null;
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: p.x - w / 2,
          top:  p.y - w / 2,
          width: w, height: w,
          borderRadius: w / 2,
          backgroundColor: color,
        }}
      />
    );
  }
  return (
    <>
      {points.slice(1).map((p, i) => (
        <Segment
          key={i}
          x1={points[i].x} y1={points[i].y}
          x2={p.x}         y2={p.y}
          color={color}    w={w}
        />
      ))}
    </>
  );
}

// ── ScratchPadModal ────────────────────────────────────────────
// Props:
//   visible         — boolean
//   onClose         — () => void
//   questionKey     — any; changes auto-clear the canvas
//   onContentChange — (hasContent: boolean) => void
export default function ScratchPadModal({ visible, onClose, questionKey, onContentChange }) {
  const [mode,       setMode]       = useState('draw');
  const [strokes,    setStrokes]    = useState([]);     // Array<Array<{x,y}>>
  const [livePts,    setLivePts]    = useState([]);     // current stroke in progress
  const [strokeSize, setStrokeSize] = useState(3);
  const [typedText,  setTypedText]  = useState('');

  const currentPts = useRef([]);

  useEffect(() => { clearAll(); }, [questionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAll = useCallback(() => {
    setStrokes([]);
    setLivePts([]);
    setTypedText('');
    currentPts.current = [];
    onContentChange?.(false);
  }, [onContentChange]);

  function handleClear() {
    setStrokes([]);
    setLivePts([]);
    currentPts.current = [];
    onContentChange?.(typedText.length > 0);
  }

  function handleUndo() {
    setStrokes(prev => {
      const next = prev.slice(0, -1);
      return next;
    });
    // notify parent outside the updater
    onContentChange?.(strokes.length > 1 || typedText.length > 0);
  }

  // ── PanResponder ─────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (evt) => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        currentPts.current = [{ x, y }];
        setLivePts([{ x, y }]);
      },

      onPanResponderMove: (evt) => {
        const { locationX: x, locationY: y } = evt.nativeEvent;
        const pts  = currentPts.current;
        if (pts.length === 0) return;
        const last = pts[pts.length - 1];
        const d    = Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2);
        if (d >= MIN_DIST) {
          const pt = { x, y };
          pts.push(pt);
          setLivePts([...pts]);
        }
      },

      onPanResponderRelease: () => {
        const pts = [...currentPts.current];
        if (pts.length > 0) {
          setStrokes(prev => [...prev, pts]);
          onContentChange?.(true); // separate — never call parent setState inside an updater fn
        }
        currentPts.current = [];
        setLivePts([]);
      },

      onPanResponderTerminate: () => {
        currentPts.current = [];
        setLivePts([]);
      },
    }),
  ).current;

  const strokeColor = '#e2e8f0';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={spStyles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={spStyles.sheet}>
        <View style={spStyles.handle} />

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={spStyles.header}>
          <View style={spStyles.headerLeft}>
            <Text style={spStyles.title}>✏️  Scratch Paper</Text>
            <View style={spStyles.tabs}>
              <TouchableOpacity
                style={[spStyles.tab, mode === 'draw' && spStyles.tabActive]}
                onPress={() => setMode('draw')}
              >
                <Text style={[spStyles.tabText, mode === 'draw' && spStyles.tabTextActive]}>Draw</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[spStyles.tab, mode === 'type' && spStyles.tabActive]}
                onPress={() => setMode('type')}
              >
                <Text style={[spStyles.tabText, mode === 'type' && spStyles.tabTextActive]}>Type</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={spStyles.headerRight}>
            {mode === 'draw' && (
              <>
                {/* Pen size cycle */}
                <TouchableOpacity style={spStyles.toolBtn} onPress={() => setStrokeSize(s => s >= 6 ? 2 : s + 2)}>
                  <View style={[spStyles.penDot, { width: strokeSize * 2, height: strokeSize * 2, borderRadius: strokeSize }]} />
                </TouchableOpacity>
                {/* Undo */}
                <TouchableOpacity
                  style={[spStyles.toolBtn, strokes.length === 0 && spStyles.toolBtnDisabled]}
                  onPress={handleUndo}
                  disabled={strokes.length === 0}
                >
                  <Text style={spStyles.toolBtnText}>↩</Text>
                </TouchableOpacity>
                {/* Clear */}
                <TouchableOpacity
                  style={[spStyles.clearBtn, strokes.length === 0 && spStyles.btnDisabled]}
                  onPress={handleClear}
                  disabled={strokes.length === 0}
                >
                  <Text style={spStyles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              </>
            )}
            {mode === 'type' && (
              <TouchableOpacity
                style={[spStyles.clearBtn, !typedText && spStyles.btnDisabled]}
                onPress={() => { setTypedText(''); onContentChange?.(strokes.length > 0); }}
                disabled={!typedText}
              >
                <Text style={spStyles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={spStyles.doneBtn} onPress={onClose}>
              <Text style={spStyles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Draw canvas ─────────────────────────────────────── */}
        {mode === 'draw' ? (
          <View
            style={spStyles.canvas}
            {...panResponder.panHandlers}
            collapsable={false}
          >
            {/* Committed strokes */}
            {strokes.map((pts, i) => (
              <Stroke key={i} points={pts} color={strokeColor} w={strokeSize} />
            ))}

            {/* Live stroke */}
            {livePts.length > 0 && (
              <Stroke points={livePts} color={strokeColor} w={strokeSize} />
            )}

            {/* Empty state */}
            {strokes.length === 0 && livePts.length === 0 && (
              <View style={spStyles.emptyHint} pointerEvents="none">
                <Text style={spStyles.emptyHintText}>Draw here to work out your answer ✏️</Text>
              </View>
            )}
          </View>
        ) : (
          /* ── Type notepad ────────────────────────────────── */
          <View style={spStyles.typeArea}>
            <TextInput
              style={spStyles.typeInput}
              multiline
              value={typedText}
              onChangeText={(t) => {
                setTypedText(t);
                onContentChange?.(t.length > 0 || strokes.length > 0);
              }}
              placeholder={"Write out your steps here...\n\ne.g.\n  1/5 × 3/9\n= (1×3) / (5×9)\n= 3/45\n= 1/15"}
              placeholderTextColor="#334155"
              autoCorrect={false}
              autoCapitalize="none"
              scrollEnabled
              textAlignVertical="top"
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Floating action button ─────────────────────────────────────
export function ScratchPadButton({ onPress, hasContent }) {
  return (
    <TouchableOpacity
      style={[spStyles.fab, hasContent && spStyles.fabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={spStyles.fabIcon}>✏️</Text>
      {hasContent && <View style={spStyles.fabDot} />}
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const spStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    height: SHEET_H,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderColor: '#1e293b',
  },
  headerLeft: { flex: 1, gap: 6 },
  title: { fontSize: 14, fontWeight: '800', color: '#e2e8f0' },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: {
    paddingVertical: 4, paddingHorizontal: 12,
    borderRadius: 20, borderWidth: 1, borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  tabActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.2)' },
  tabText:       { fontSize: 12, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#c4b5fd' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  toolBtnDisabled: { opacity: 0.3 },
  toolBtnText: { fontSize: 16, color: '#94a3b8' },
  penDot: { backgroundColor: '#e2e8f0' },
  clearBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
  },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  btnDisabled: { opacity: 0.3 },
  doneBtn: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8,
    backgroundColor: '#7c3aed',
  },
  doneBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  // Canvas
  canvas: {
    flex: 1, backgroundColor: '#111827',
    overflow: 'hidden', position: 'relative',
  },
  emptyHint: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyHintText: { fontSize: 14, color: '#1e293b', fontWeight: '600' },

  // Notepad
  typeArea: { flex: 1, backgroundColor: '#111827', padding: 16 },
  typeInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#e2e8f0',
    lineHeight: 26,
    textAlignVertical: 'top',
  },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1e293b',
    borderWidth: 1.5, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    zIndex: 999,
  },
  fabActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.2)' },
  fabIcon: { fontSize: 22 },
  fabDot: {
    position: 'absolute', top: 6, right: 6,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#7c3aed',
    borderWidth: 1.5, borderColor: '#0f172a',
  },
});
