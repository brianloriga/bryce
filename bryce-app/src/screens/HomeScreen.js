import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getCustomUnits, deleteCustomUnit, getQuizResultsForKid } from '../services/supabase';
import KidAvatar from '../components/KidAvatar';

const CARD_COLORS = [
  '#2563eb', '#7c3aed', '#db2777',
  '#ea580c', '#16a34a', '#0891b2', '#b45309',
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const { activeKid, isLoggedIn } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [units, setUnits]           = useState([]);
  const [resultsMap, setResultsMap] = useState({});
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError]   = useState(null);
  const [search, setSearch]         = useState('');

  useFocusEffect(
    useCallback(() => {
      loadUnits();
    }, [isLoggedIn])
  );

  async function loadUnits() {
    if (!isLoggedIn) { setLoading(false); setUnits([]); return; }
    setLoadError(null);
    try {
      const [data, results] = await Promise.all([
        getCustomUnits(),
        activeKid?.id ? getQuizResultsForKid(activeKid.id) : Promise.resolve([]),
      ]);
      setUnits(data);
      const map = {};
      for (const r of results) {
        const key = r.unit_id ?? r.unit_title;
        if (!map[key] || r.stars > map[key].stars || (r.stars === map[key].stars && r.score > map[key].score)) {
          map[key] = { stars: r.stars, score: r.score, total: r.total, attempts: 0 };
        }
        map[key].attempts = (map[key].attempts ?? 0) + 1;
      }
      setResultsMap(map);
    } catch (err) {
      setLoadError(err.message ?? 'Could not load units');
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
      'This will permanently remove this lesson and all its questions.',
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={theme.statusBar} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const filteredUnits = search.trim()
    ? units.filter(u => u.title.toLowerCase().includes(search.toLowerCase()))
    : units;

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={theme.statusBar} />
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn't load lessons</Text>
          <Text style={styles.errorDesc}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); loadUnits(); }}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={theme.statusBar} />
      <ScrollView
        contentContainerStyle={[styles.content, filteredUnits.length === 0 && styles.contentEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {activeKid ? (
            <KidAvatar name={activeKid.name} color={activeKid.avatar} size={88} radius={22} />
          ) : null}
          <Text style={styles.greeting}>
            {activeKid ? `Hi, ${activeKid.name}!` : 'Welcome!'}
          </Text>
          <Text style={styles.greetingSub}>
            {units.length > 0
              ? `${units.length} lesson${units.length !== 1 ? 's' : ''} ready to study`
              : 'Your lessons will appear here'}
          </Text>
        </View>

        {/* Search bar */}
        {units.length > 2 && (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search lessons…"
              placeholderTextColor={theme.textMuted}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        )}

        {/* Unit cards */}
        {filteredUnits.length > 0 ? (
          <View style={styles.unitList}>
            {filteredUnits.map((unit, i) => {
              const color  = CARD_COLORS[i % CARD_COLORS.length];
              const qCount = unit.questions?.length ?? 0;
              const best   = resultsMap[unit.id] ?? resultsMap[unit.title] ?? null;
              return (
                <TouchableOpacity
                  key={unit.id}
                  style={[styles.unitCard, { backgroundColor: color }]}
                  onPress={() => navigation.navigate('Quiz', { unit })}
                  onLongPress={() => confirmDelete(unit)}
                  activeOpacity={0.88}
                >
                  <View style={styles.unitCardTop}>
                    <View style={styles.unitCardLeft}>
                      <Text style={styles.unitCardTitle} numberOfLines={2}>{unit.title}</Text>
                      <Text style={styles.unitCardMeta}>{qCount} question{qCount !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={styles.playBtn}>
                      <Ionicons name="play" size={22} color="#fff" />
                    </View>
                  </View>

                  <View style={styles.scoreStrip}>
                    {best ? (
                      <>
                        <Text style={styles.scoreStars}>
                          {[1,2,3].map(n => n <= best.stars ? '⭐' : '☆').join('')}
                        </Text>
                        <Text style={styles.scoreText}>
                          Best: {best.score}/{best.total}
                        </Text>
                        <Text style={styles.attemptsText}>
                          {best.attempts} attempt{best.attempts !== 1 ? 's' : ''}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.notPlayedText}>Not played yet — give it a try!</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name={search ? 'search' : 'book-outline'} size={44} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{search ? 'No matches' : 'No lessons yet'}</Text>
            <Text style={styles.emptyDesc}>
              {search
                ? `No lessons found for "${search}"`
                : isLoggedIn
                  ? 'Tap the Scan tab to photograph a textbook page.\nQuestions will appear here instantly.'
                  : 'Sign in to view your lessons.'}
            </Text>
            {search ? (
              <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearch('')}>
                <Text style={styles.clearSearchText}>Clear search</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {filteredUnits.length > 0 && (
          <Text style={styles.hintText}>Hold a lesson to delete it</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: t.bg },
    center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content:      { padding: 20, paddingBottom: 40 },
    contentEmpty: { flex: 1 },

    // Header
    header: { marginBottom: 24, paddingTop: 8, alignItems: 'flex-start', gap: 14 },
    greeting:    { fontSize: 32, fontWeight: '800', color: t.text, marginBottom: 4 },
    greetingSub: { fontSize: 15, color: t.textSub },

    // Search
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: t.bgCard, borderRadius: 14,
      borderWidth: 1, borderColor: t.border,
      paddingHorizontal: 14, paddingVertical: 11,
      marginBottom: 20,
    },
    searchInput: { flex: 1, fontSize: 15, color: t.text },

    // Cards
    unitList: { gap: 14 },
    unitCard: {
      borderRadius: 20, padding: 20, flexDirection: 'column',
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 5,
    },
    unitCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    unitCardLeft: { flex: 1, marginRight: 12 },
    unitCardTitle: {
      fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4, lineHeight: 26,
    },
    unitCardMeta: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
    playBtn: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },

    // Score strip
    scoreStrip: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 12,
    },
    scoreStars:    { fontSize: 16 },
    scoreText:     { fontSize: 13, fontWeight: '700', color: '#fff' },
    attemptsText:  { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 'auto' },
    notPlayedText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' },

    // Empty
    empty: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 24, paddingTop: 60,
    },
    emptyIconCircle: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: t.bgCard,
      borderWidth: 1, borderColor: t.border,
      alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    emptyTitle: { fontSize: 24, fontWeight: '800', color: t.text, marginBottom: 10 },
    emptyDesc:  { fontSize: 15, color: t.textSub, textAlign: 'center', lineHeight: 24 },
    hintText:   { fontSize: 12, color: t.textMuted, textAlign: 'center', marginTop: 20 },

    // Error
    errorEmoji: { fontSize: 48, marginBottom: 12 },
    errorTitle: { fontSize: 20, fontWeight: '800', color: t.text, marginBottom: 6 },
    errorDesc:  { fontSize: 14, color: t.textSub, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    retryBtn: {
      backgroundColor: t.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28,
    },
    retryBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },

    // Clear search
    clearSearchBtn:  { marginTop: 16 },
    clearSearchText: { fontSize: 14, color: t.accent, fontWeight: '600' },
  });
}
