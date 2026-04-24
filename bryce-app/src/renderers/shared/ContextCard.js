import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Allowed icon names map to Ionicons "-outline" variants.
// GPT picks from a restricted list defined in the edge function prompt.
const ICON_MAP = {
  car: 'car-outline', bicycle: 'bicycle-outline', bus: 'bus-outline',
  train: 'train-outline', airplane: 'airplane-outline', boat: 'boat-outline',
  walk: 'walk-outline', rocket: 'rocket-outline', subway: 'subway-outline',
  paw: 'paw-outline', fish: 'fish-outline', bug: 'bug-outline',
  bird: 'egg-outline',
  egg: 'egg-outline', leaf: 'leaf-outline', flower: 'flower-outline',
  rose: 'rose-outline', water: 'water-outline', flame: 'flame-outline', snow: 'snow-outline',
  rainy: 'rainy-outline', sunny: 'sunny-outline', 'partly-sunny': 'partly-sunny-outline',
  cloud: 'cloud-outline', thunderstorm: 'thunderstorm-outline',
  umbrella: 'umbrella-outline', thermometer: 'thermometer-outline', moon: 'moon-outline',
  planet: 'planet-outline', globe: 'globe-outline', earth: 'earth-outline',
  telescope: 'telescope-outline',
  flask: 'flask-outline', magnet: 'magnet-outline', flash: 'flash-outline',
  bulb: 'bulb-outline', prism: 'prism-outline', pulse: 'pulse-outline',
  bandage: 'bandage-outline', medkit: 'medkit-outline',
  body: 'body-outline', eye: 'eye-outline', ear: 'ear-outline',
  person: 'person-outline', people: 'people-outline',
  man: 'man-outline', woman: 'woman-outline', baby: 'happy-outline',
  male: 'male-outline', female: 'female-outline',
  book: 'book-outline', school: 'school-outline', pencil: 'pencil-outline',
  backpack: 'backpack-outline', library: 'library-outline',
  clipboard: 'clipboard-outline', brush: 'brush-outline',
  'color-palette': 'color-palette-outline', calculator: 'calculator-outline',
  document: 'document-outline',
  medal: 'medal-outline', trophy: 'trophy-outline', ribbon: 'ribbon-outline',
  star: 'star-outline', podium: 'podium-outline',
  basketball: 'basketball-outline', football: 'american-football-outline',
  baseball: 'baseball-outline', tennisball: 'tennisball-outline',
  golf: 'golf-outline', fitness: 'fitness-outline', stopwatch: 'stopwatch-outline',
  nutrition: 'nutrition-outline', pizza: 'pizza-outline',
  'fast-food': 'fast-food-outline', 'ice-cream': 'ice-cream-outline',
  cafe: 'cafe-outline', restaurant: 'restaurant-outline', cart: 'cart-outline',
  cash: 'cash-outline', card: 'card-outline', bag: 'bag-outline',
  gift: 'gift-outline', pricetag: 'pricetag-outline',
  receipt: 'receipt-outline', wallet: 'wallet-outline',
  clock: 'time-outline', time: 'time-outline', hourglass: 'hourglass-outline',
  timer: 'timer-outline', calendar: 'calendar-outline', alarm: 'alarm-outline',
  home: 'home-outline', flag: 'flag-outline', storefront: 'storefront-outline',
  key: 'key-outline', map: 'map-outline', compass: 'compass-outline',
  location: 'location-outline', pin: 'pin-outline', newspaper: 'newspaper-outline',
  cube: 'cube-outline', shapes: 'shapes-outline', triangle: 'triangle-outline',
  square: 'square-outline', diamond: 'diamond-outline', ellipse: 'ellipse-outline',
  infinite: 'infinite-outline', 'pie-chart': 'pie-chart-outline',
  'bar-chart': 'bar-chart-outline', 'stats-chart': 'stats-chart-outline',
  'musical-note': 'musical-note-outline', 'musical-notes': 'musical-notes-outline',
  heart: 'heart-outline',
  grid: 'grid-outline', layers: 'layers-outline', image: 'image-outline',
};

export default function ContextCard({ context, accentColor }) {
  if (!context?.type) return null;
  const accent = accentColor ?? '#60a5fa';

  if (context.type === 'grid') {
    const items = context.items ?? [];
    const pairs = [];
    for (let i = 0; i < items.length; i += 2) {
      pairs.push([items[i], items[i + 1] ?? null]);
    }
    return (
      <View style={styles.card}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.inner}>
          {context.title ? <Text style={styles.title}>{context.title}</Text> : null}
          {pairs.map((pair, pi) => (
            <View key={pi} style={styles.row}>
              {pair.map((item, ii) => item ? (
                <View key={ii} style={styles.cell}>
                  <View style={[styles.iconCircle, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
                    <Ionicons name={ICON_MAP[item.icon] ?? 'grid-outline'} size={22} color={accent} />
                  </View>
                  <Text style={styles.cellLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={[styles.cellValue, { color: accent }]}>{item.value}</Text>
                </View>
              ) : (
                <View key={ii} style={styles.cellEmpty} />
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (context.type === 'table') {
    const columns = context.columns ?? [];
    const rows    = context.rows    ?? [];
    return (
      <View style={styles.card}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.inner}>
          {context.title ? <Text style={styles.title}>{context.title}</Text> : null}
          {columns.length > 0 && (
            <View style={styles.tableRow}>
              {columns.map((col, ci) => (
                <Text key={ci} style={[styles.tableHeader, { color: accent }]}>{col}</Text>
              ))}
            </View>
          )}
          {rows.map((row, ri) => (
            <View key={ri} style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}>
              {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                <Text key={ci} style={styles.tableCell}>{String(cell)}</Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a2744',
    borderRadius: 16, marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  accentBar: { width: 4, borderRadius: 4 },
  inner:     { flex: 1, padding: 14 },
  title:     { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  row:       { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cell:      { flex: 1, alignItems: 'center', gap: 6 },
  cellEmpty: { flex: 1 },
  iconCircle:{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cellLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
  cellValue: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  tableRow:    { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.03)' },
  tableHeader: { flex: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  tableCell:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
});
