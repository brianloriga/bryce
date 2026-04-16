import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Image, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Placeholder screen for Phase 3 (Camera + AI question generation)
// This will be built out fully in Phase 3.

export default function ScanScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.hero}>
          <Text style={styles.heroIcon}>📸</Text>
          <Text style={styles.heroTitle}>Scan a Textbook Page</Text>
          <Text style={styles.heroSubtitle}>
            Take a photo of any textbook page and our AI will instantly create
            practice questions for your child.
          </Text>
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>How it works</Text>
          {[
            { icon: '📖', text: 'Open your child\'s textbook to this week\'s lesson' },
            { icon: '📷', text: 'Take a clear photo of the page' },
            { icon: '🤖', text: 'AI reads the content and creates 9 practice questions' },
            { icon: '⭐', text: 'Questions appear in the game — your child earns stars!' },
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepIcon}>{step.icon}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>🔒 Coming in the Premium Plan</Text>
        </View>

        <TouchableOpacity style={styles.ctaButton} disabled>
          <Text style={styles.ctaButtonText}>📷  Scan Textbook Page</Text>
          <Text style={styles.ctaButtonSub}>Requires subscription</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Supports any grade level. Works with printed textbooks, workbooks,
          and worksheets.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  heroIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  stepsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepIcon: {
    fontSize: 22,
    marginRight: 12,
    width: 30,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  comingSoonBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  comingSoonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  ctaButton: {
    backgroundColor: '#94a3b8',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  ctaButtonSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  note: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
