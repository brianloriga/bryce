import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

const LAST_UPDATED = 'April 17, 2026';

const SECTIONS = [
  {
    title: 'Acceptance of terms',
    body: 'By creating a SnapStudy account you agree to these Terms of Service. If you do not agree, please do not use the app. You must be 18 or older to create an account.',
  },
  {
    title: 'Parent accounts only',
    body: 'SnapStudy accounts are for parents and legal guardians only. You are responsible for all activity that occurs under your account, including the activity of child profiles you create.',
  },
  {
    title: 'Content you upload',
    body: [
      'You may only upload images of material you have the right to use (e.g., textbooks your family owns).',
      'Do not upload images that contain other people\'s private information, explicit content, or material that violates copyright.',
      'AI-generated questions are for personal educational use only and may not be redistributed or sold.',
    ],
  },
  {
    title: 'Subscriptions & payments',
    body: 'Premium features require an active paid subscription. Subscriptions are billed through the Apple App Store and are subject to Apple\'s payment terms. You may cancel at any time through your App Store account settings. Refunds are handled by Apple in accordance with their refund policy.',
  },
  {
    title: 'Educational disclaimer',
    body: 'SnapStudy is a supplementary learning tool. We make no guarantee that use of the app will improve academic performance or test scores. AI-generated questions should be reviewed by a parent before use.',
  },
  {
    title: 'Limitation of liability',
    body: 'SnapStudy is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the app.',
  },
  {
    title: 'Termination',
    body: 'We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the new terms. We will notify you of material changes via the app or email.',
  },
  {
    title: 'Contact',
    body: 'Questions? Email: support@snapstudy.app',
  },
];

export default function TermsScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
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
