import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getCustomUnits, deleteCustomUnit } from '../services/supabase';

const CARD_COLORS = [
  '#2563eb', '#7c3aed', '#db2777',
  '#ea580c', '#16a34a', '#0891b2', '#b45309',
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const { activeKid, isLoggedIn } = useAuth();

  const [units, setUnits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reload units every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUnits();
    }, [isLoggedIn])
  );

  async function loadUnits() {
    if (!isLoggedIn) { setLoading(false); setUnits([]); return; }
    try {
      const data = await getCustomUnits();
      setUnits(data);
    } catch (err) {
      console.warn('[HomeScreen] loadUnits error:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadUnits();
    setRefreshing(false);
  }

  function confirmDelete(unit) {
    Alert.alert(
      `Delete "${unit.title}"?`,
      'This will permanently remove this unit and all its questions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomUnit(unit.id);
              setUnits(prev => prev.filter(u => u.id !== unit.id));
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, units.length === 0 && styles.contentEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {activeKid ? (
            <View style={styles.kidBadge}>
              <Text style={styles.kidBadgeEmoji}>{activeKid.avatar}</Text>
              <Text style={styles.kidBadgeName}>{activeKid.name}</Text>
            </View>
          ) : null}
          <Text style={styles.greeting}>
            {activeKid ? `Hi, ${activeKid.name}! 👋` : 'Welcome!'}
          </Text>
          <Text style={styles.greetingSub}>
            {units.length > 0
              ? `${units.length} unit${units.length !== 1 ? 's' : ''} ready to study`
              : 'Your study units will appear here'}
          </Text>
        </View>

        {/* Unit cards */}
        {units.length > 0 ? (
          <View style={styles.unitList}>
            {units.map((unit, i) => {
              const color = CARD_COLORS[i % CARD_COLORS.length];
              const qCount = unit.questions?.length ?? 0;
              return (
                <TouchableOpacity
                  key={unit.id}
                  style={[styles.unitCard, { backgroundColor: color }]}
                  onPress={() => navigation.navigate('Quiz', { unit })}
                  onLongPress={() => confirmDelete(unit)}
                  activeOpacity={0.88}
                >
                  <View style={styles.unitCardLeft}>
                    <Text style={styles.unitCardTitle} numberOfLines={2}>{unit.title}</Text>
                    <Text style={styles.unitCardMeta}>{qCount} question{qCount !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.playBtn}>
                    <Text style={styles.playBtnText}>▶</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Empty state */
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>📚</Text>
            </View>
            <Text style={styles.emptyTitle}>No units yet</Text>
            <Text style={styles.emptyDesc}>
              {isLoggedIn
                ? 'A parent can tap the Scan tab to photograph a textbook page.\nQuestions will appear here instantly.'
                : 'Sign in to view your study units.'}
            </Text>
          </View>
        )}

        {units.length > 0 && (
          <Text style={styles.hintText}>Hold a unit to delete it</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#f1f5f9' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:      { padding: 20, paddingBottom: 40 },
  contentEmpty: { flex: 1 },

  header: {
    marginBottom: 28,
    paddingTop: 8,
  },
  kidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#dbeafe', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: 12,
  },
  kidBadgeEmoji: { fontSize: 16 },
  kidBadgeName:  { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },

  greeting:    { fontSize: 32, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  greetingSub: { fontSize: 15, color: '#64748b' },

  unitList: { gap: 14 },

  unitCard: {
    borderRadius: 20,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  unitCardLeft: { flex: 1, marginRight: 12 },
  unitCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    lineHeight: 26,
  },
  unitCardMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  playBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnText: { fontSize: 18, color: '#fff', marginLeft: 3 },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  emptyDesc:  {
    fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 24,
  },

  hintText: {
    fontSize: 12, color: '#cbd5e1', textAlign: 'center', marginTop: 20,
  },
});
