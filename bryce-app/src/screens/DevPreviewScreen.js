/**
 * DevPreviewScreen – Development only.
 * Lists every sample question set so you can jump straight into QuizScreen
 * for any question type / variant without needing a real scan or login.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SAMPLE_GROUPS } from '../dev/sampleQuestions';
import { devLogger } from '../utils/devLogger';
import { GAME_REGISTRY } from '../minigames/registry';

// Sample units that have at least 2 MC questions — usable by every mini-game
const MC_SAMPLES = SAMPLE_GROUPS
  .flatMap(g => g.items.map(item => ({ groupTitle: g.title, ...item })))
  .filter(item =>
    (item.unit.questions ?? []).filter(q => Array.isArray(q.options) && q.options.length >= 2).length >= 2,
  )
  .map(item => ({
    id:         item.id,
    label:      item.label,
    groupTitle: item.groupTitle,
    unit:       item.unit,
    mcCount:    item.unit.questions.filter(q => Array.isArray(q.options) && q.options.length >= 2).length,
  }));

const HEADER_HEIGHT = 70;

export default function DevPreviewScreen() {
  const navigation  = useNavigation();
  const { height }  = useWindowDimensions();
  const [logs,         setLogs]         = useState([]);
  const [expandedIds,  setExpandedIds]  = useState({});
  const [expandedGames, setExpandedGames] = useState({});

  function toggleExpand(id) {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleGame(id) {
    setExpandedGames(prev => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => devLogger.subscribe(setLogs), []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#94a3b8" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Dev Preview</Text>
          <Text style={styles.headerSub}>All question types &amp; variants</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && { height: height - HEADER_HEIGHT, maxHeight: height - HEADER_HEIGHT }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS !== 'web'}
      >
        <View style={styles.banner}>
          <Ionicons name="flask" size={20} color="#f59e0b" />
          <Text style={styles.bannerText}>
            Development mode — tap any card to open that question type in the quiz player
          </Text>
        </View>

        {/* ── Mini-Games ──────────────────────────────────── */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Mini-Games</Text>
          {GAME_REGISTRY.filter(g => g.available && g.component).map(game => {
            const open = !!expandedGames[game.id];
            return (
              <View key={game.id} style={gameStyles.gameCard}>
                {/* Game header row */}
                <TouchableOpacity
                  style={gameStyles.gameHeader}
                  onPress={() => toggleGame(game.id)}
                  activeOpacity={0.75}
                >
                  <Text style={gameStyles.gameEmoji}>{game.emoji}</Text>
                  <View style={gameStyles.gameInfo}>
                    <Text style={gameStyles.gameName}>{game.label}</Text>
                    <Text style={gameStyles.gameDesc} numberOfLines={2}>{game.description}</Text>
                  </View>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#475569"
                  />
                </TouchableOpacity>

                {/* Expanded sample unit list */}
                {open && (
                  <View style={gameStyles.sampleList}>
                    {MC_SAMPLES.length === 0 ? (
                      <Text style={gameStyles.noSamples}>No MC samples found</Text>
                    ) : (
                      MC_SAMPLES.map(sample => (
                        <TouchableOpacity
                          key={sample.id}
                          style={gameStyles.sampleRow}
                          onPress={() => navigation.navigate(game.routeName, { unit: sample.unit })}
                          activeOpacity={0.75}
                        >
                          <View style={gameStyles.sampleLeft}>
                            <Text style={gameStyles.sampleLabel}>{sample.label}</Text>
                            <Text style={gameStyles.sampleMeta}>
                              {sample.mcCount} MC question{sample.mcCount !== 1 ? 's' : ''}
                              {'  ·  '}{sample.groupTitle}
                            </Text>
                          </View>
                          <Ionicons name="play-circle-outline" size={20} color="#3b82f6" />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {SAMPLE_GROUPS.map(group => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map(sample => (
              <TouchableOpacity
                key={sample.id}
                style={styles.card}
                onPress={() => navigation.navigate('Quiz', { unit: sample.unit })}
                activeOpacity={0.75}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.cardLabel}>{sample.label}</Text>
                  <Text style={styles.cardMeta}>
                    {sample.unit.questions.length} question{sample.unit.questions.length !== 1 ? 's' : ''}
                    {sample.unit.passage ? '  •  read-along' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#475569" />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* ── Scan Generation Logs ─────────────────────── */}
        <View style={styles.group}>
          <View style={logStyles.logHeader}>
            <Text style={styles.groupTitle}>Scan Logs</Text>
            <Text style={logStyles.logCount}>{logs.length} entr{logs.length === 1 ? 'y' : 'ies'}</Text>
            {logs.length > 0 && (
              <TouchableOpacity onPress={() => devLogger.clearAll()} style={logStyles.clearBtn}>
                <Text style={logStyles.clearBtnText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {logs.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardMeta}>No scans yet — run a generation and logs will appear here automatically.</Text>
            </View>
          ) : (
            logs.map(log => {
              const ok       = log.result?.success;
              const expanded = !!expandedIds[log.id];
              const dur      = log.durationMs ? (log.durationMs / 1000).toFixed(1) + 's' : '…';
              const ts       = new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const date     = new Date(log.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
              const apiEvt   = log.events?.find(e => e.label === 'api_call_end');
              const apiMs    = apiEvt ? apiEvt.elapsedMs : null;

              return (
                <TouchableOpacity
                  key={log.id}
                  activeOpacity={0.75}
                  onPress={() => toggleExpand(log.id)}
                  style={[styles.card, logStyles.logCard, ok ? logStyles.cardOk : logStyles.cardFail]}
                >
                  {/* Header row */}
                  <View style={logStyles.row}>
                    <Text style={ok ? logStyles.statusOk : logStyles.statusFail}>
                      {ok ? '✅ Success' : '❌ Failed'}
                    </Text>
                    <Text style={logStyles.ts}>{date}  {ts}</Text>
                    <Text style={logStyles.dur}>{dur}</Text>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color="#475569"
                    />
                  </View>

                  {/* Input summary */}
                  <Text style={logStyles.meta}>
                    {log.pageCount} page{log.pageCount !== 1 ? 's' : ''}
                    {log.visualAidCount > 0 ? `  ·  ${log.visualAidCount} visual aid${log.visualAidCount !== 1 ? 's' : ''}` : ''}
                    {'  ·  '}requested {log.totalRequested}
                  </Text>

                  {/* Output summary */}
                  {ok && (
                    <Text style={logStyles.meta}>
                      Generated {log.result.questionsGenerated}
                      {log.result.textGenerated != null
                        ? `  (${log.result.textGenerated} text + ${log.result.visualGenerated} visual)`
                        : ''}
                      {log.result.droppedCount ? `  ·  dropped ${log.result.droppedCount}` : ''}
                    </Text>
                  )}

                  {/* Error — always show full message, no line clamp */}
                  {!ok && log.result?.error && (
                    <Text style={logStyles.errorText}>
                      {log.result.error}
                    </Text>
                  )}

                  {/* Expanded details */}
                  {expanded && (
                    <>
                      {/* API timing */}
                      {apiMs != null && (
                        <Text style={logStyles.timing}>
                          ⏱  API call: {(apiMs / 1000).toFixed(1)}s  ·  total: {dur}
                        </Text>
                      )}

                      {/* Events timeline */}
                      {log.events?.length > 0 && (
                        <View style={logStyles.eventsBox}>
                          {log.events.map((e, ei) => (
                            <Text key={ei} style={logStyles.eventRow}>
                              {String(e.elapsedMs).padStart(5, ' ')}ms  {e.label}
                            </Text>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1c1f2e',
    borderWidth: 1,
    borderColor: '#f59e0b40',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  bannerText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 13,
    lineHeight: 18,
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardLeft: {
    flex: 1,
  },
  cardLabel: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  cardMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
  },
});

const gameStyles = StyleSheet.create({
  gameCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    marginBottom: 8,
    overflow: 'hidden',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  gameEmoji: { fontSize: 28, lineHeight: 32 },
  gameInfo:  { flex: 1 },
  gameName:  { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  gameDesc:  { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 16 },

  sampleList: {
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    paddingVertical: 4,
  },
  sampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  sampleLeft: { flex: 1 },
  sampleLabel: { fontSize: 13, fontWeight: '600', color: '#e2e8f0' },
  sampleMeta:  { fontSize: 11, color: '#475569', marginTop: 2 },
  noSamples:   { fontSize: 13, color: '#475569', padding: 14, textAlign: 'center' },
});

const logStyles = StyleSheet.create({
  logHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  logCount:    { fontSize: 11, color: '#475569', fontWeight: '600' },
  clearBtn:    { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#7f1d1d', borderRadius: 8 },
  clearBtnText:{ fontSize: 11, fontWeight: '700', color: '#fca5a5' },

  cardOk:   { borderColor: '#166534' },
  cardFail: { borderColor: '#7f1d1d' },
  logCard:  { flexDirection: 'column', alignItems: 'stretch' },

  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusOk:  { fontSize: 13, fontWeight: '700', color: '#4ade80', flex: 1 },
  statusFail:{ fontSize: 13, fontWeight: '700', color: '#f87171', flex: 1 },
  ts:        { fontSize: 11, color: '#475569' },
  dur:       { fontSize: 11, fontWeight: '700', color: '#94a3b8' },

  meta:      { fontSize: 12, color: '#64748b', marginBottom: 2 },
  timing:    { fontSize: 12, color: '#7c3aed', marginTop: 4, fontWeight: '600' },
  errorText: { fontSize: 12, color: '#f87171', marginTop: 4, lineHeight: 18 },

  eventsBox: {
    marginTop: 8, backgroundColor: '#0f172a',
    borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: '#1e293b',
  },
  eventRow: { fontSize: 10, color: '#475569', fontFamily: 'monospace', lineHeight: 16 },
});
