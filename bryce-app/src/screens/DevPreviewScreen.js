/**
 * DevPreviewScreen – Development only.
 * Lists every sample question set so you can jump straight into QuizScreen
 * for any question type / variant without needing a real scan or login.
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SAMPLE_GROUPS } from '../dev/sampleQuestions';

const HEADER_HEIGHT = 70;

export default function DevPreviewScreen() {
  const navigation = useNavigation();
  const { height } = useWindowDimensions();

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
