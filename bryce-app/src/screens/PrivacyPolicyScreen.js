import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

const LAST_UPDATED = 'April 17, 2026';

const SECTIONS = [
  {
    title: 'Who we are',
    body: 'SnapStudy ("we", "our", "us") is a mobile application that helps parents create custom practice questions for their children by photographing textbook pages. This Privacy Policy explains how we collect, use, and protect information when you use the app.',
  },
  {
    title: 'Information we collect',
    body: [
      'Parent email address and password (stored securely in Supabase, encrypted at rest).',
      "Child profile names and avatar emoji — no child's real photo, birth date, or school information is collected.",
      'Quiz scores for each child profile, used to track progress within the app.',
      'Textbook page photos you choose to upload — these are sent to OpenAI for question generation and are not stored permanently by SnapStudy.',
    ],
  },
  {
    title: 'Children\'s privacy (COPPA)',
    body: 'SnapStudy is designed for parents, not children. Only adults (parents or guardians) create accounts. We do not knowingly collect personal information directly from children under 13. Children interact with the app through a parent-managed kid profile that contains only a first name and a chosen emoji avatar.',
  },
  {
    title: 'How we use your information',
    body: [
      'To authenticate your account and keep your child profiles secure.',
      'To sync quiz progress across your devices.',
      'To generate practice questions from the photos you submit (via OpenAI GPT-4o Vision).',
      'We do not sell your data to advertisers or third parties.',
    ],
  },
  {
    title: 'Third-party services',
    body: [
      'Supabase (supabase.com) — stores your account, kid profiles, and quiz scores.',
      'OpenAI (openai.com) — receives textbook page photos to generate questions. Photos are processed per OpenAI\'s API data usage policy and are not used to train models by default.',
    ],
  },
  {
    title: 'Data retention & deletion',
    body: 'You can delete your account and all associated data at any time by emailing us. When an account is deleted, all kid profiles and quiz scores are permanently removed from our database.',
  },
  {
    title: 'Security',
    body: 'All data is transmitted over HTTPS. Passwords are hashed and never stored in plain text. Parent PINs are stored encrypted on-device using the device\'s secure storage.',
  },
  {
    title: 'Contact us',
    body: 'Questions or data deletion requests? Email: privacy@snapstudy.app',
  },
];

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            {Array.isArray(s.body) ? (
              s.body.map((item, j) => (
                <View key={j} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.bodyText}>{s.body}</Text>
            )}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f8fafc' },
  header:  { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 15, color: '#2563eb', fontWeight: '600' },
  title:   { fontSize: 26, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  updated: { fontSize: 12, color: '#94a3b8' },

  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  bodyText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  bulletRow: { flexDirection: 'row', marginBottom: 6, paddingRight: 8 },
  bullet:    { fontSize: 14, color: '#94a3b8', marginRight: 8, marginTop: 1 },
  bulletText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 22 },
});
