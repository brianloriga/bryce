import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TouchableOpacity } from 'react-native';

const chipColors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4'];

export default function OrderingRenderer({ q, onResolve, styles }) {
  const [placed, setPlaced]     = useState([]);
  const [feedback, setFeedback] = useState(null);
  const items = q.items ?? [];

  function tapChip(itemIdx) {
    if (feedback) return;
    if (placed.includes(itemIdx)) return;
    const next = [...placed, itemIdx];
    setPlaced(next);
    if (next.length === items.length) {
      const correct = next.every((v, i) => v === q.correctOrder[i]);
      setFeedback(correct ? 'correct' : 'wrong');
      if (correct) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => onResolve(correct), 1800);
    }
  }

  function removeFromSlot(slotIdx) {
    if (feedback) return;
    setPlaced(placed.slice(0, slotIdx));
  }

  function clear() {
    if (feedback) return;
    setPlaced([]);
  }

  return (
    <View>
      <Text style={styles.orderingLabel}>Your order:</Text>
      <View style={styles.orderingSlots}>
        {items.map((_, slotIdx) => {
          const placedItemIdx = placed[slotIdx];
          const filled  = placedItemIdx !== undefined;
          const correct = feedback && q.correctOrder[slotIdx] === placedItemIdx;
          const wrong   = feedback && !correct && filled;
          const SlotEl  = filled && !feedback ? TouchableOpacity : View;
          return (
            <SlotEl key={slotIdx}
              style={[
                styles.orderingSlot,
                filled && { backgroundColor: chipColors[placedItemIdx % chipColors.length] + '33', borderColor: chipColors[placedItemIdx % chipColors.length] },
                correct && styles.orderingSlotCorrect,
                wrong   && styles.orderingSlotWrong,
              ]}
              onPress={filled && !feedback ? () => removeFromSlot(slotIdx) : undefined}
              activeOpacity={0.65}>
              <Text style={styles.orderingSlotNum}>{slotIdx + 1}</Text>
              {filled && (
                <Text style={[styles.orderingSlotText, correct && { color: '#4ade80' }, wrong && { color: '#f87171' }]}>
                  {items[placedItemIdx]}
                </Text>
              )}
              {filled && !feedback && (
                <Text style={{ position: 'absolute', top: 3, right: 5, fontSize: 9, color: '#475569', fontWeight: '700' }}>✕</Text>
              )}
            </SlotEl>
          );
        })}
      </View>

      <Text style={styles.orderingLabel}>Tap to place:</Text>
      <View style={styles.orderingChips}>
        {items.map((item, idx) => {
          const used = placed.includes(idx);
          return (
            <TouchableOpacity key={idx}
              style={[styles.orderingChip, { borderColor: chipColors[idx % chipColors.length] }, used && styles.orderingChipUsed]}
              onPress={() => tapChip(idx)} disabled={used || !!feedback} activeOpacity={0.75}>
              <Text style={[styles.orderingChipText, used && styles.orderingChipTextUsed]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!feedback && placed.length > 0 && (
        <TouchableOpacity style={styles.orderingClear} onPress={clear}>
          <Text style={styles.orderingClearText}>Clear</Text>
        </TouchableOpacity>
      )}

      {feedback === 'wrong' && (
        <View style={styles.orderingReveal}>
          <Text style={styles.fillInRevealLabel}>Correct order:</Text>
          <Text style={styles.fillInRevealAnswer}>
            {q.correctOrder.map(i => items[i]).join(' → ')}
          </Text>
        </View>
      )}
    </View>
  );
}
