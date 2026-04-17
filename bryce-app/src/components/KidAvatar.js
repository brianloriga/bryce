import React from 'react';
import { View, Text } from 'react-native';
import { getAvatarColor } from '../utils/avatars';

/**
 * Renders a rounded-square block with the child's first initial on a solid color.
 *
 * Props:
 *  name   — child's name (first letter used as initial)
 *  color  — hex color stored in avatar field (falls back to default)
 *  size   — width & height in px (default 60)
 *  radius — border radius (default size * 0.25)
 */
export default function KidAvatar({ name = '?', color, size = 60, radius }) {
  const bg      = getAvatarColor(color);
  const br      = radius ?? Math.round(size * 0.25);
  const letter  = (name || '?')[0].toUpperCase();
  const fontSize = Math.round(size * 0.46);

  return (
    <View style={{
      width: size, height: size, borderRadius: br,
      backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontSize,
        fontWeight: '900',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.18)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
        includeFontPadding: false,
        lineHeight: fontSize * 1.2,
      }}>
        {letter}
      </Text>
    </View>
  );
}
