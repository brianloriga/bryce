import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';

// Matches plain "num/den" fractions like 3/4, 18/24, 157/8
// Requires word-boundary before numerator so we don't break URLs or dates
const FRAC_RE = /(?<![/\d])(\d{1,4})\/(\d{1,4})(?![/\d])/g;

// Stacked fraction — a small column: numerator / bar / denominator
function StackedFraction({ num, den, color = '#fff', size = 16 }) {
  const numStr = String(num);
  const denStr = String(den);
  const partSize = size * 0.72;
  const barWidth = Math.max(numStr.length, denStr.length) * partSize * 0.65 + 8;

  const containerStyle = Platform.OS === 'web'
    ? { display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        verticalAlign: 'middle', marginHorizontal: 3 }
    : { flexDirection: 'column', alignItems: 'center', marginHorizontal: 3 };

  return (
    <View style={containerStyle}>
      <Text style={{ fontSize: partSize, color, lineHeight: partSize + 2, fontWeight: '600' }}>
        {numStr}
      </Text>
      <View style={{ height: 1.5, width: barWidth, backgroundColor: color, marginVertical: 1 }} />
      <Text style={{ fontSize: partSize, color, lineHeight: partSize + 2, fontWeight: '600' }}>
        {denStr}
      </Text>
    </View>
  );
}

/**
 * FractionText
 *
 * Renders a string replacing any "num/den" patterns with a stacked fraction.
 * All other text is rendered as normal.
 *
 * Props:
 *   children  — the text string to render
 *   style     — Text style (applied to non-fraction runs)
 *   fontSize  — base font size (default 17)
 *   color     — text + fraction bar colour (default '#fff')
 *   centered  — if true, centres the row (useful for standalone fractions)
 */
export default function FractionText({
  children,
  style,
  fontSize = 17,
  color,
  centered = false,
}) {
  const text = String(children ?? '');

  // Resolve colour: explicit prop wins, then flatten style to extract colour, then white
  const flatStyle = style ? StyleSheet.flatten(style) : {};
  const resolvedColor = color ?? flatStyle?.color ?? '#fff';

  // Quick bail-out — no fractions → plain Text
  FRAC_RE.lastIndex = 0;
  if (!FRAC_RE.test(text)) {
    FRAC_RE.lastIndex = 0;
    return <Text style={[{ fontSize, color: resolvedColor }, style]}>{text}</Text>;
  }
  FRAC_RE.lastIndex = 0;

  // Split text into alternating text-runs and fraction objects
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = FRAC_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'frac', num: match[1], den: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  const rowStyle = [
    styles.row,
    centered && styles.centered,
  ];

  return (
    <View style={rowStyle}>
      {parts.map((part, i) =>
        part.type === 'frac' ? (
          <StackedFraction key={i} num={part.num} den={part.den} color={resolvedColor} size={fontSize} />
        ) : (
          <Text key={i} style={[{ fontSize, color: resolvedColor }, style]}>
            {part.value}
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  centered: {
    justifyContent: 'center',
  },
});
