import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { GAME_REGISTRY } from '../minigames/registry';
import { getEnabledMap, setGameEnabled } from '../services/gameSettings';

const AVAILABLE = GAME_REGISTRY.filter(g => g.available);
const COMING    = GAME_REGISTRY.filter(g => !g.available);

export default function GameManagerScreen() {
  const navigation = useNavigation();
  const { theme }  = useTheme();
  const styles     = useMemo(() => createStyles(theme), [theme]);

  const [enabledMap, setEnabledMap] = useState({});

  useEffect(() => {
    getEnabledMap(GAME_REGISTRY.map(g => g.id)).then(setEnabledMap);
  }, []);

  async function toggle(gameId, value) {
    setEnabledMap(prev => ({ ...prev, [gameId]: value }));
    await setGameEnabled(gameId, value);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={theme.statusBar} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Game Library</Text>
          <Text style={styles.headerSub}>Enable or disable games for your kids</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* How it works */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={theme.accent} style={{ marginRight: 10, flexShrink: 0 }} />
          <Text style={styles.infoText}>
            Enabled games appear as quick-launch buttons on every lesson card and unlock after scoring 70%+ on a quiz.
          </Text>
        </View>

        {/* Available games */}
        <Text style={styles.sectionLabel}>Available Games</Text>
        <View style={styles.card}>
          {AVAILABLE.map((game, i) => {
            const isEnabled = enabledMap[game.id] !== false;
            return (
              <View key={game.id} style={[styles.gameRow, i < AVAILABLE.length - 1 && styles.gameRowBorder]}>
                <View style={[styles.gameIconCircle, { backgroundColor: isEnabled ? theme.accentDim : theme.bgCard }]}>
                  <Text style={styles.gameEmoji}>{game.emoji}</Text>
                </View>
                <View style={styles.gameInfo}>
                  <Text style={[styles.gameLabel, !isEnabled && styles.gameLabelDisabled]}>
                    {game.label}
                  </Text>
                  <Text style={styles.gameDesc} numberOfLines={2}>
                    {game.description}
                  </Text>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={v => toggle(game.id, v)}
                  trackColor={{ false: theme.border, true: theme.accent + '80' }}
                  thumbColor={isEnabled ? theme.accent : theme.textMuted}
                  ios_backgroundColor={theme.bgCard}
                />
              </View>
            );
          })}
        </View>

        {/* Coming soon */}
        {COMING.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Coming Soon</Text>
            <View style={styles.card}>
              {COMING.map((game, i) => (
                <View key={game.id} style={[styles.gameRow, styles.gameRowDimmed, i < COMING.length - 1 && styles.gameRowBorder]}>
                  <View style={[styles.gameIconCircle, { backgroundColor: theme.bgCard }]}>
                    <Text style={styles.gameEmoji}>{game.emoji}</Text>
                  </View>
                  <View style={styles.gameInfo}>
                    <Text style={[styles.gameLabel, styles.gameLabelDisabled]}>{game.label}</Text>
                    <Text style={styles.gameDesc}>{game.description}</Text>
                  </View>
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>SOON</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Phase 8 note */}
        <View style={styles.roadmapCard}>
          <Text style={styles.roadmapTitle}>🗺️  Roadmap</Text>
          <Text style={styles.roadmapText}>
            More games are coming in Phase 8 — Match-Up (drag &amp; drop), Flash Cards, Speed Boss Battle, and more. Each new game will appear here automatically when it's ready.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48 },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: t.border,
      gap: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: t.bgCard, borderWidth: 1, borderColor: t.border,
      alignItems: 'center', justifyContent: 'center',
    },
    headerText:  { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: t.text },
    headerSub:   { fontSize: 12, color: t.textMuted, marginTop: 1 },

    infoCard: {
      flexDirection: 'row', alignItems: 'flex-start',
      backgroundColor: t.accentDim, borderRadius: 14,
      padding: 14, marginBottom: 22,
      borderWidth: 1, borderColor: t.accent + '30',
    },
    infoText: { flex: 1, fontSize: 13, color: t.textSub, lineHeight: 19 },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: t.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10,
    },

    card: {
      backgroundColor: t.bgCard, borderRadius: 18,
      borderWidth: 1, borderColor: t.border, marginBottom: 24, overflow: 'hidden',
    },

    gameRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 16, paddingHorizontal: 16, gap: 14,
    },
    gameRowBorder: {
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    gameRowDimmed: { opacity: 0.5 },

    gameIconCircle: {
      width: 48, height: 48, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: t.border, flexShrink: 0,
    },
    gameEmoji: { fontSize: 24 },

    gameInfo: { flex: 1 },
    gameLabel: { fontSize: 16, fontWeight: '800', color: t.text, marginBottom: 3 },
    gameLabelDisabled: { color: t.textMuted },
    gameDesc:  { fontSize: 12, color: t.textSub, lineHeight: 17 },

    soonBadge: {
      backgroundColor: t.border, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 4,
    },
    soonBadgeText: { fontSize: 10, fontWeight: '800', color: t.textMuted, letterSpacing: 0.5 },

    roadmapCard: {
      backgroundColor: t.bgCard, borderRadius: 16,
      padding: 16, borderWidth: 1, borderColor: t.border,
    },
    roadmapTitle: { fontSize: 15, fontWeight: '800', color: t.text, marginBottom: 8 },
    roadmapText:  { fontSize: 13, color: t.textSub, lineHeight: 20 },
  });
}
