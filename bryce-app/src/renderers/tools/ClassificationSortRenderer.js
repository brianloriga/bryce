import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';

// ── Color palette ───────────────────────────────────────────────
const CAT_COLORS = {
  green:  { accent: '#4ade80', chipBg: '#14532d', text: '#4ade80' },
  blue:   { accent: '#60a5fa', chipBg: '#1e3a5f', text: '#60a5fa' },
  orange: { accent: '#fb923c', chipBg: '#431407', text: '#fb923c' },
};
function catColor(key) {
  return CAT_COLORS[key] ?? { accent: '#94a3b8', chipBg: '#334155', text: '#94a3b8' };
}

// ── ShakeChip ───────────────────────────────────────────────────
function ShakeChip({ isShaking, children }) {
  const anim  = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);
  if (isShaking && !fired.current) {
    fired.current = true;
    Animated.sequence([
      Animated.timing(anim, { toValue:  8, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue:  6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue:  0, duration: 50, useNativeDriver: true }),
    ]).start();
  } else if (!isShaking) {
    fired.current = false;
  }
  return (
    <Animated.View style={{ transform: [{ translateX: anim }] }}>
      {children}
    </Animated.View>
  );
}

// ── CategoryColumn ──────────────────────────────────────────────
function CategoryColumn({ category, placedItems, isActive, shakingSet, onPress }) {
  const p = catColor(category.color);
  return (
    <TouchableOpacity
      style={{ flex: 1 }}
      onPress={onPress}
      activeOpacity={isActive ? 0.75 : 0.95}
    >
      <View style={[
        cStyles.column,
        { borderTopColor: p.accent },
        isActive && { borderColor: p.accent, backgroundColor: '#162032' },
      ]}>
        {/* Header */}
        <View style={[cStyles.columnHeader, isActive && { backgroundColor: p.accent + '33' }]}>
          <Text style={[cStyles.columnLabel, { color: p.accent }]} numberOfLines={2}>
            {category.label}
          </Text>
          {isActive && (
            <Text style={[cStyles.tapHint, { color: p.accent }]}>Tap to place ↓</Text>
          )}
        </View>

        {/* Placed chips */}
        <View style={cStyles.columnBody}>
          {placedItems.length === 0 ? (
            <View style={[cStyles.emptySlot, { borderColor: p.accent + '44' }]}>
              <Text style={[cStyles.emptyHint, { color: p.accent + '55' }]}>
                {isActive ? '← Tap to place' : 'Empty'}
              </Text>
            </View>
          ) : (
            placedItems.map(item => (
              <ShakeChip key={item.text} isShaking={shakingSet.has(item.text)}>
                <View style={[cStyles.chip, { backgroundColor: p.chipBg, borderColor: p.accent }]}>
                  <Text style={[cStyles.chipText, { color: p.text }]} numberOfLines={2}>
                    {item.text}
                  </Text>
                </View>
              </ShakeChip>
            ))
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main renderer ───────────────────────────────────────────────
export default function ClassificationSortRenderer({ q, onResolve }) {
  const geo        = q.geometry ?? {};
  const categories = geo.categories ?? [];
  const items      = geo.items      ?? [];

  const [placements, setPlacements] = useState(() =>
    Object.fromEntries(items.map(i => [i.text, null]))
  );
  const [selected,  setSelected]  = useState(null);
  const [feedback,  setFeedback]  = useState(null);
  const [shaking,   setShaking]   = useState(() => new Set());

  const allPlaced = items.every(i => placements[i.text] !== null);

  // ── Tap a bank chip ───────────────────────────────────────────
  function handleChipTap(text) {
    if (feedback) return;
    Haptics.selectionAsync();
    // Second tap on the same chip deselects it
    setSelected(prev => (prev === text ? null : text));
  }

  // ── Tap a placed chip — return it to bank ─────────────────────
  function handlePlacedChipTap(text) {
    if (feedback) return;
    Haptics.selectionAsync();
    setPlacements(prev => ({ ...prev, [text]: null }));
    setSelected(null);
  }

  // ── Tap a column — place the selected chip ────────────────────
  function handleColumnTap(catLabel) {
    if (!selected || feedback) return;
    Haptics.selectionAsync();
    setPlacements(prev => ({ ...prev, [selected]: catLabel }));
    setSelected(null);
  }

  // ── Check ─────────────────────────────────────────────────────
  function handleCheck() {
    if (feedback || !allPlaced) return;
    const wrong = items.filter(i => placements[i.text] !== i.correctCategory);
    if (wrong.length === 0) {
      setFeedback('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => onResolve(true), 1000);
    } else {
      setFeedback('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const wrongSet = new Set(wrong.map(i => i.text));
      setShaking(wrongSet);
      setTimeout(() => {
        setPlacements(prev => {
          const next = { ...prev };
          wrong.forEach(i => { next[i.text] = null; });
          return next;
        });
        setShaking(new Set());
        setFeedback(null);
      }, 900);
    }
  }

  const bankItems = items.filter(i => placements[i.text] === null);
  const placedIn  = cat => items.filter(i => placements[i.text] === cat);

  // Placed chip tap (only when not in feedback)
  function PlacedChip({ item, color }) {
    const p = catColor(color);
    if (feedback) {
      return (
        <View style={[cStyles.chip, { backgroundColor: p.chipBg, borderColor: p.accent }]}>
          <Text style={[cStyles.chipText, { color: p.text }]} numberOfLines={2}>{item.text}</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity onPress={() => handlePlacedChipTap(item.text)} activeOpacity={0.7}>
        <View style={[cStyles.chip, { backgroundColor: p.chipBg, borderColor: p.accent }]}>
          <Text style={[cStyles.chipText, { color: p.text }]} numberOfLines={2}>{item.text}</Text>
          <Text style={cStyles.removeHint}>✕</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={cStyles.root}>

      {/* Step hint */}
      <Text style={cStyles.stepHint}>
        {selected
          ? `"${selected}" selected — tap a category to place it`
          : allPlaced
            ? 'All placed — tap Check to confirm!'
            : 'Tap a card, then tap a category'}
      </Text>

      {/* Category columns */}
      <View style={cStyles.columnsRow}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.label}
            style={{ flex: 1 }}
            onPress={() => handleColumnTap(cat.label)}
            activeOpacity={selected ? 0.75 : 0.95}
          >
            <View style={[
              cStyles.column,
              { borderTopColor: catColor(cat.color).accent },
              selected && { borderColor: catColor(cat.color).accent, backgroundColor: '#162032' },
            ]}>
              <View style={[
                cStyles.columnHeader,
                selected && { backgroundColor: catColor(cat.color).accent + '22' },
              ]}>
                <Text style={[cStyles.columnLabel, { color: catColor(cat.color).accent }]} numberOfLines={2}>
                  {cat.label}
                </Text>
                {selected && (
                  <Text style={[cStyles.tapHint, { color: catColor(cat.color).accent }]}>
                    Tap to place ↓
                  </Text>
                )}
              </View>
              <View style={cStyles.columnBody}>
                {placedIn(cat.label).length === 0 ? (
                  <View style={[cStyles.emptySlot, { borderColor: catColor(cat.color).accent + '44' }]}>
                    <Text style={[cStyles.emptyHint, { color: catColor(cat.color).accent + '55' }]}>
                      {selected ? '← Tap to place' : 'Empty'}
                    </Text>
                  </View>
                ) : (
                  placedIn(cat.label).map(item => (
                    <ShakeChip key={item.text} isShaking={shaking.has(item.text)}>
                      <PlacedChip item={item} color={cat.color} />
                    </ShakeChip>
                  ))
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chip bank */}
      <View style={cStyles.bankSection}>
        <View style={cStyles.bank}>
          {bankItems.map(item => (
            <TouchableOpacity
              key={item.text}
              onPress={() => handleChipTap(item.text)}
              activeOpacity={0.7}
              disabled={!!feedback}
            >
              <View style={[
                cStyles.chip,
                selected === item.text && cStyles.chipSelected,
                !!feedback && cStyles.chipDisabled,
              ]}>
                <Text style={[
                  cStyles.chipText,
                  selected === item.text && cStyles.chipTextSelected,
                ]} numberOfLines={2}>
                  {item.text}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Feedback banners */}
      {feedback === 'correct' && (
        <View style={cStyles.successBanner}>
          <Text style={cStyles.successText}>✓ Perfect — every item sorted correctly! 🎉</Text>
        </View>
      )}
      {feedback === 'wrong' && (
        <View style={cStyles.wrongBanner}>
          <Text style={cStyles.wrongText}>
            Some items were in the wrong category. They're back in the bank — try again!
          </Text>
        </View>
      )}

      {/* Check button */}
      {!feedback && (
        <TouchableOpacity
          style={[cStyles.checkBtn, !allPlaced && cStyles.checkBtnDisabled]}
          onPress={handleCheck}
          disabled={!allPlaced}
          activeOpacity={0.85}
        >
          <Text style={cStyles.checkBtnText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const cStyles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingBottom: 8,
    width: '100%',
  },

  // Step hint
  stepHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16,
  },

  // Columns
  columnsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  column: {
    flex: 1,
    borderTopWidth: 3,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    minHeight: 120,
  },
  columnHeader: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  columnLabel: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tapHint: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  columnBody: {
    flex: 1,
    padding: 6,
    gap: 4,
    minHeight: 80,
    alignItems: 'stretch',
  },
  emptySlot: {
    flex: 1,
    minHeight: 60,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Chips
  chip: {
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 3,
    marginHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: '#f1f5f9',
    backgroundColor: '#334155',
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  chipTextSelected: {
    color: '#f1f5f9',
  },
  removeHint: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '700',
    marginLeft: 4,
  },

  // Bank
  bankSection: {
    width: '100%',
    marginBottom: 14,
  },
  bank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },

  // Feedback
  successBanner: {
    backgroundColor: '#052e16',
    borderWidth: 1.5,
    borderColor: '#4ade80',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  successText: { color: '#4ade80', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  wrongBanner: {
    backgroundColor: '#1c0a0a',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  wrongText: { color: '#fca5a5', fontWeight: '600', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Check button
  checkBtn: {
    backgroundColor: '#4ade80',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
    marginTop: 2,
  },
  checkBtnDisabled: {
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
  },
  checkBtnText: { fontSize: 16, fontWeight: '800', color: '#052e16' },
});
