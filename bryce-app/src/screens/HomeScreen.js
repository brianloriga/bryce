import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Dimensions, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getCustomUnits, deleteCustomUnit, getQuizResultsForKid } from '../services/supabase';
import KidAvatar from '../components/KidAvatar';
import {
  DEFAULT_SUBJECTS, UNASSIGNED_SUBJECT, buildSubjectList, resolveSubject,
} from '../utils/subjects';
import { AVAILABLE_GAMES, GAME_REGISTRY } from '../minigames/registry';
import { getEnabledMap } from '../services/gameSettings';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING  = 20;   // horizontal padding on each side
const GRID_GAP      = 14;   // gap between the two columns
const TILE_SIZE     = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function HomeScreen() {
  const navigation = useNavigation();
  const { activeKid, kidProfiles, selectKid, isLoggedIn } = useAuth();
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const { theme }  = useTheme();
  const styles     = useMemo(() => createStyles(theme), [theme]);

  const [units, setUnits]           = useState([]);
  const [resultsMap, setResultsMap] = useState({});
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError]   = useState(null);
  const [search, setSearch]         = useState('');
  // null = subject grid; string key = drill-in view
  const [activeSubject, setActiveSubject] = useState(null);
  const [enabledGames, setEnabledGames]   = useState({});

  useFocusEffect(
    useCallback(() => {
      loadUnits();
      getEnabledMap(GAME_REGISTRY.map(g => g.id)).then(setEnabledGames);
    }, [isLoggedIn])
  );

  async function loadUnits(kidId = activeKid?.id) {
    if (!isLoggedIn) { setLoading(false); setUnits([]); return; }
    setLoadError(null);
    try {
      const [data, results] = await Promise.all([
        getCustomUnits(kidId ?? null),
        kidId ? getQuizResultsForKid(kidId) : Promise.resolve([]),
      ]);
      setUnits(data);
      const map = {};
      for (const r of results) {
        const key = r.unit_id ?? r.unit_title;
        if (!map[key] || r.stars > map[key].stars ||
            (r.stars === map[key].stars && r.score > map[key].score)) {
          map[key] = { stars: r.stars, score: r.score, total: r.total, attempts: 0 };
        }
        map[key].attempts = (map[key].attempts ?? 0) + 1;
      }
      setResultsMap(map);
    } catch (err) {
      setLoadError(err.message ?? 'Could not load lessons');
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
            } catch (err) { Alert.alert('Error', err.message); }
          },
        },
      ]
    );
  }

  // ── Derived data — all hooks before any early returns ────────
  const allSubjects = useMemo(() => buildSubjectList(units), [units]);

  const countBySubject = useMemo(() => {
    const map = {};
    for (const u of units) {
      const k = (!u.subject || u.subject === 'custom') ? 'unassigned' : u.subject;
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [units]);

  const activeSubjectTiles = useMemo(
    () => allSubjects.filter(s => (countBySubject[s.key] ?? 0) > 0),
    [allSubjects, countBySubject]
  );

  const unassignedCount = countBySubject['unassigned'] ?? 0;

  // Lessons shown when drilling into a subject
  const subjectLessons = useMemo(() => {
    if (!activeSubject) return [];
    return units.filter(u => {
      const k = (!u.subject || u.subject === 'custom') ? 'unassigned' : u.subject;
      return k === activeSubject;
    });
  }, [units, activeSubject]);

  // Global search across ALL lessons (used on the grid landing view)
  const globalSearchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return units.filter(u => u.title.toLowerCase().includes(q));
  }, [units, search]);

  // Filtered lessons when inside a subject drill-in
  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjectLessons;
    return subjectLessons.filter(u => u.title.toLowerCase().includes(q));
  }, [subjectLessons, search]);

  const drillSubject = useMemo(() =>
    activeSubject
      ? (allSubjects.find(s => s.key === activeSubject) ?? UNASSIGNED_SUBJECT)
      : null,
  [activeSubject, allSubjects]);

  // ── Loading ──────────────────────────────────────────────────
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

  // ── Error ────────────────────────────────────────────────────
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

  // ── Shared lesson card ───────────────────────────────────────
  function LessonCard({ unit }) {
    const subject = resolveSubject(unit.subject, allSubjects);
    const qCount  = unit.questions?.length ?? 0;
    const best    = resultsMap[unit.id] ?? resultsMap[unit.title] ?? null;

    // Which available games apply to this unit?
    // Speed Round (and any future MC-based game) needs options arrays.
    const hasMC = (unit.questions ?? []).some(
      q => Array.isArray(q.options) && q.options.length >= 2,
    );
    const applicableGames = AVAILABLE_GAMES.filter(g => {
      if (enabledGames[g.id] === false) return false;
      if (g.id === 'speed_round' || g.id === 'memory_flip') return hasMC;
      return true;
    });

    return (
      <View style={[styles.unitCard, { backgroundColor: subject.color }]}>
        {/* ── Main quiz tap area ── */}
        <TouchableOpacity
          style={styles.unitCardMain}
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
                <Text style={styles.scoreText}>Best: {best.score}/{best.total}</Text>
                <Text style={styles.attemptsText}>
                  {best.attempts} attempt{best.attempts !== 1 ? 's' : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.notPlayedText}>Not played yet — give it a try!</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* ── Mini-game quick-launch chips ── */}
        {applicableGames.length > 0 && (
          <View style={styles.gameChipsRow}>
            {applicableGames.map(game => (
              <TouchableOpacity
                key={game.id}
                style={styles.gameChip}
                onPress={() => navigation.navigate(game.routeName, { unit })}
                activeOpacity={0.75}
              >
                <Text style={styles.gameChipEmoji}>{game.emoji}</Text>
                <Text style={styles.gameChipLabel}>{game.label}</Text>
                <Text style={styles.gameChipChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── Subject grid view ────────────────────────────────────────
  if (!activeSubject) {
    const isSearching = search.trim().length > 0;

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={theme.statusBar} />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <TouchableOpacity
            style={styles.header}
            onPress={() => kidProfiles.length > 1 && setSwitcherVisible(true)}
            activeOpacity={kidProfiles.length > 1 ? 0.75 : 1}
          >
            {activeKid ? (
              <KidAvatar name={activeKid.name} color={activeKid.avatar} size={64} radius={18} />
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.greeting}>
                {activeKid ? `Hi, ${activeKid.name}!` : 'Welcome!'}
              </Text>
              <Text style={styles.greetingSub}>
                {units.length > 0
                  ? `${units.length} lesson${units.length !== 1 ? 's' : ''} ready to study`
                  : 'Your lessons will appear here'}
              </Text>
            </View>
            {kidProfiles.length > 1 && (
              <View style={styles.switchChevron}>
                <Ionicons name="swap-horizontal-outline" size={18} color={theme.textSub} />
                <Text style={styles.switchLabel}>Switch</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Global search bar — always visible when there are lessons */}
          {units.length > 0 && (
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search all lessons…"
                placeholderTextColor={theme.textMuted}
                value={search}
                onChangeText={setSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
          )}

          {/* ── Search results mode ── */}
          {isSearching ? (
            globalSearchResults.length > 0 ? (
              <View style={styles.unitList}>
                {globalSearchResults.map(unit => <LessonCard key={unit.id} unit={unit} />)}
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="search" size={40} color={theme.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyDesc}>No lessons found for "{search}"</Text>
                <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearch('')}>
                  <Text style={styles.clearSearchText}>Clear search</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            /* ── Subject tiles mode ── */
            <>
              <Text style={styles.sectionLabel}>Subjects</Text>

              {units.length === 0 ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="book-outline" size={44} color={theme.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>No lessons yet</Text>
                  <Text style={styles.emptyDesc}>
                    {isLoggedIn
                      ? 'Tap the Scan tab to photograph a textbook page.\nQuestions will appear here instantly.'
                      : 'Sign in to view your lessons.'}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Strict 2-column grid — render pairs as rows */}
                  {chunkPairs([
                    ...activeSubjectTiles,
                    ...(unassignedCount > 0 ? [{ ...UNASSIGNED_SUBJECT, _isUnassigned: true }] : []),
                  ]).map((pair, rowIdx) => (
                    <View key={rowIdx} style={styles.tileRow}>
                      {pair.map(subject => (
                        <SubjectTile
                          key={subject.key}
                          subject={subject}
                          count={subject._isUnassigned ? unassignedCount : (countBySubject[subject.key] ?? 0)}
                          styles={styles}
                          onPress={() => setActiveSubject(subject.key)}
                        />
                      ))}
                      {/* If odd number, fill second slot with empty spacer */}
                      {pair.length === 1 && <View style={styles.tileSpacer} />}
                    </View>
                  ))}

                  {activeSubjectTiles.length < DEFAULT_SUBJECTS.length && (
                    <View style={styles.emptySubjectsHint}>
                      <Text style={styles.emptySubjectsHintText}>
                        Assign a subject when scanning to organise lessons here
                      </Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>

        {/* Kid switcher modal */}
        {KidSwitcherModal()}
      </SafeAreaView>
    );
  }

  // ── Lesson list inside a subject ─────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={theme.statusBar} />
      <ScrollView
        contentContainerStyle={[styles.content, filteredLessons.length === 0 && styles.contentEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back header */}
        <View style={styles.subjectHeader}>
          <TouchableOpacity
            onPress={() => { setActiveSubject(null); setSearch(''); }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Image source={drillSubject.image} style={styles.subjectHeaderIcon} resizeMode="contain" />
          <Text style={styles.subjectHeaderTitle}>{drillSubject.label}</Text>
          <Text style={styles.subjectHeaderCount}>
            {subjectLessons.length} lesson{subjectLessons.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Search within subject */}
        {subjectLessons.length > 0 && (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${drillSubject.label}…`}
              placeholderTextColor={theme.textMuted}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        )}

        {filteredLessons.length > 0 ? (
          <View style={styles.unitList}>
            {filteredLessons.map(unit => <LessonCard key={unit.id} unit={unit} />)}
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
                : 'No lessons in this subject yet.'}
            </Text>
            {search ? (
              <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearch('')}>
                <Text style={styles.clearSearchText}>Clear search</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {filteredLessons.length > 0 && (
          <Text style={styles.hintText}>Hold a lesson to delete it</Text>
        )}
      </ScrollView>

      {/* Kid switcher modal */}
      {KidSwitcherModal()}
    </SafeAreaView>
  );

  // ── Kid switcher modal (shared by both returns) ───────────────
  function KidSwitcherModal() {
    return (
      <Modal visible={switcherVisible} transparent animationType="slide" onRequestClose={() => setSwitcherVisible(false)}>
        <TouchableOpacity style={styles.switcherOverlay} activeOpacity={1} onPress={() => setSwitcherVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.switcherSheet}>
            <View style={styles.switcherHandle} />
            <Text style={styles.switcherTitle}>Who's learning?</Text>
            <View style={styles.switcherGrid}>
              {kidProfiles.map(kid => {
                const isActive = activeKid?.id === kid.id;
                return (
                  <TouchableOpacity
                    key={kid.id}
                    style={[styles.switcherKidBtn, isActive && styles.switcherKidBtnActive]}
                    onPress={async () => {
                      if (!isActive) {
                        setUnits([]);
                        setResultsMap({});
                        setActiveSubject(null);
                        setLoading(true);
                        setSwitcherVisible(false);
                        await selectKid(kid);
                        loadUnits(kid.id);
                      } else {
                        setSwitcherVisible(false);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <KidAvatar name={kid.name} color={kid.avatar} size={64} radius={16} />
                    <Text style={[styles.switcherKidName, isActive && styles.switcherKidNameActive]}>
                      {kid.name}
                    </Text>
                    {isActive && (
                      <View style={styles.switcherActiveDot}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.switcherDismiss} onPress={() => setSwitcherVisible(false)}>
              <Text style={styles.switcherDismissText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────
/** Split an array into consecutive pairs [[a,b],[c,d],...] */
function chunkPairs(arr) {
  const rows = [];
  for (let i = 0; i < arr.length; i += 2) {
    rows.push(arr.slice(i, i + 2));
  }
  return rows;
}

// ── Subject tile component ───────────────────────────────────
function SubjectTile({ subject, count, styles, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.tileCard, { backgroundColor: subject.color }]}>
        {/* Rounded icon wrapper */}
        <View style={styles.tileIconWrapper}>
          <Image source={subject.image} style={styles.tileIcon} resizeMode="contain" />
        </View>
        <View style={styles.tileCountBadge}>
          <Text style={styles.tileCountText}>{count}</Text>
        </View>
      </View>
      <Text style={styles.tileLabel} numberOfLines={2}>{subject.label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(t) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: t.bg },
    center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content:      { padding: GRID_PADDING, paddingBottom: 48 },
    contentEmpty: { flex: 1 },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      marginBottom: 20, paddingTop: 6,
    },
    headerText:   { flex: 1 },
    greeting:     { fontSize: 26, fontWeight: '800', color: t.text, marginBottom: 2 },
    greetingSub:  { fontSize: 13, color: t.textSub },
    switchChevron: {
      alignItems: 'center', gap: 2,
      backgroundColor: t.bgCard, borderRadius: 10,
      paddingHorizontal: 10, paddingVertical: 6,
      borderWidth: 1, borderColor: t.border,
    },
    switchLabel:  { fontSize: 10, fontWeight: '700', color: t.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Kid switcher modal
    switcherOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    switcherSheet: {
      backgroundColor: t.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: 24, paddingBottom: 40,
      borderTopWidth: 1, borderColor: t.border,
    },
    switcherHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: t.border, alignSelf: 'center', marginBottom: 20 },
    switcherTitle:    { fontSize: 18, fontWeight: '800', color: t.text, textAlign: 'center', marginBottom: 24 },
    switcherGrid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 24 },
    switcherKidBtn: {
      alignItems: 'center', gap: 8, padding: 12,
      borderRadius: 18, borderWidth: 2, borderColor: t.border,
      backgroundColor: t.bg, minWidth: 90,
    },
    switcherKidBtnActive: { borderColor: t.accent, backgroundColor: t.accentDim },
    switcherKidName:       { fontSize: 13, fontWeight: '700', color: t.textSub, textAlign: 'center' },
    switcherKidNameActive: { color: t.accent },
    switcherActiveDot: {
      position: 'absolute', top: 8, right: 8,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center',
    },
    switcherDismiss:     { paddingVertical: 14, alignItems: 'center' },
    switcherDismissText: { fontSize: 15, color: t.textSub, fontWeight: '600' },

    // Search bar
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: t.bgCard, borderRadius: 14,
      borderWidth: 1, borderColor: t.border,
      paddingHorizontal: 14, paddingVertical: 11,
      marginBottom: 22,
    },
    searchInput: { flex: 1, fontSize: 15, color: t.text },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: t.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 14,
    },

    // Tile grid — explicit rows of 2
    tileRow: {
      flexDirection: 'row',
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    // Outer wrapper — width = TILE_SIZE, centred label below card
    tile: {
      width: TILE_SIZE,
      alignItems: 'center',
    },
    tileSpacer: {
      width: TILE_SIZE,
    },
    // Coloured card
    tileCard: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 6,
      marginBottom: 10,
    },
    // White rounded container for the icon — gives it a "card within card" look
    tileIconWrapper: {
      width: TILE_SIZE * 0.58,
      height: TILE_SIZE * 0.58,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    tileIcon: {
      width: '80%',
      height: '80%',
    },
    tileLabel: {
      fontSize: 15, fontWeight: '800', color: t.text,
      textAlign: 'center', lineHeight: 20,
    },
    tileCountBadge: {
      position: 'absolute', top: 10, right: 10,
      minWidth: 26, height: 26, borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.28)',
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 6,
    },
    tileCountText: { fontSize: 12, fontWeight: '800', color: '#fff' },

    emptySubjectsHint: { marginTop: 12, alignItems: 'center' },
    emptySubjectsHintText: {
      fontSize: 12, color: t.textMuted, textAlign: 'center', lineHeight: 19,
    },

    // Subject drill-in header
    subjectHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginBottom: 20, paddingTop: 4,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: t.bgCard, borderWidth: 1, borderColor: t.border,
      alignItems: 'center', justifyContent: 'center',
    },
    subjectHeaderIcon: { width: 32, height: 32, borderRadius: 8 },
    subjectHeaderTitle: { fontSize: 22, fontWeight: '800', color: t.text, flex: 1 },
    subjectHeaderCount: { fontSize: 13, color: t.textMuted, fontWeight: '600' },

    // Lesson cards
    unitList: { gap: 14 },
    unitCard: {
      borderRadius: 20, overflow: 'hidden',
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18, shadowRadius: 12, elevation: 5,
    },
    unitCardMain:  { padding: 20 },
    unitCardTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    unitCardLeft: { flex: 1, marginRight: 12 },
    unitCardTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4, lineHeight: 26 },
    unitCardMeta:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
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

    // Mini-game quick-launch chips
    gameChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    gameChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.22)',
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      flex: 1,
    },
    gameChipEmoji:   { fontSize: 15 },
    gameChipLabel:   { flex: 1, fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
    gameChipChevron: { fontSize: 18, color: 'rgba(255,255,255,0.45)', fontWeight: '300' },

    // Empty state
    empty: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 24, paddingTop: 60,
    },
    emptyIconCircle: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: t.bgCard, borderWidth: 1, borderColor: t.border,
      alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    emptyTitle: { fontSize: 24, fontWeight: '800', color: t.text, marginBottom: 10 },
    emptyDesc:  { fontSize: 15, color: t.textSub, textAlign: 'center', lineHeight: 24 },
    hintText:   { fontSize: 12, color: t.textMuted, textAlign: 'center', marginTop: 20 },

    // Error state
    errorEmoji: { fontSize: 48, marginBottom: 12 },
    errorTitle: { fontSize: 20, fontWeight: '800', color: t.text, marginBottom: 6 },
    errorDesc:  { fontSize: 14, color: t.textSub, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    retryBtn:   { backgroundColor: t.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 },
    retryBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },

    clearSearchBtn:  { marginTop: 16 },
    clearSearchText: { fontSize: 14, color: t.accent, fontWeight: '600' },
  });
}
