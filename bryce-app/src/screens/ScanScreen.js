import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Alert, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { generateQuestionsFromImage } from '../services/aiService';
import { saveCustomUnit } from '../services/supabase';

export default function ScanScreen() {
  const navigation  = useNavigation();
  const { isLoggedIn } = useAuth();

  const [image, setImage]         = useState(null);  // { uri, base64 }
  const [loading, setLoading]     = useState(false);
  const [questions, setQuestions] = useState(null);  // generated questions array
  const [unitTitle, setUnitTitle] = useState('');
  const [saving, setSaving]       = useState(false);
  const [step, setStep]           = useState('pick'); // 'pick' | 'generating' | 'preview' | 'saved'

  // ── Image picker ─────────────────────────────────────────
  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
      setStep('pick');
      setQuestions(null);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
      setStep('pick');
      setQuestions(null);
    }
  }

  // ── AI generation ─────────────────────────────────────────
  async function handleGenerate() {
    if (!image?.base64) {
      Alert.alert('No image', 'Please take or select a photo first.');
      return;
    }
    setStep('generating');
    setLoading(true);
    try {
      const result = await generateQuestionsFromImage(image.base64);
      setUnitTitle(result.title ?? 'New Unit');
      setQuestions(result.questions ?? []);
      setStep('preview');
    } catch (err) {
      Alert.alert('Generation failed', err.message ?? 'Something went wrong. Please try again.');
      setStep('pick');
    } finally {
      setLoading(false);
    }
  }

  // ── Edit a question ───────────────────────────────────────
  function updateQuestion(index, field, value) {
    setQuestions(prev => prev.map((q, i) =>
      i === index ? { ...q, [field]: value } : q
    ));
  }

  function removeQuestion(index) {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  }

  // ── Save to Supabase ──────────────────────────────────────
  async function handleSave() {
    if (!unitTitle.trim()) {
      Alert.alert('Title required', 'Please give this unit a name.');
      return;
    }
    if (!questions || questions.length === 0) {
      Alert.alert('No questions', 'Add at least one question before saving.');
      return;
    }
    setSaving(true);
    try {
      await saveCustomUnit(unitTitle.trim(), questions);
      setStep('saved');
    } catch (err) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setImage(null); setQuestions(null);
    setUnitTitle(''); setStep('pick');
  }

  // ── Not logged in ─────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.gateEmoji}>📸</Text>
          <Text style={styles.gateTitle}>Sign in to scan</Text>
          <Text style={styles.gateDesc}>
            Create a parent account to use the textbook scanner and generate custom practice questions.
          </Text>
          <TouchableOpacity
            style={styles.gateBtn}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.gateBtnText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Saved success ─────────────────────────────────────────
  if (step === 'saved') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.gateEmoji}>🎉</Text>
          <Text style={styles.gateTitle}>Unit saved!</Text>
          <Text style={styles.gateDesc}>
            "{unitTitle}" has been added. Bryce will see it in their game next time they play.
          </Text>
          <TouchableOpacity style={styles.gateBtn} onPress={reset}>
            <Text style={styles.gateBtnText}>Scan another page</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Generating ────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.generatingTitle}>Generating questions…</Text>
          <Text style={styles.generatingDesc}>
            AI is reading the page and writing 9 practice questions.{'\n'}This takes about 10 seconds.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Preview / Edit ────────────────────────────────────────
  if (step === 'preview' && questions) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>Review Questions</Text>
          <Text style={styles.pageSubtitle}>Edit or remove any questions before saving.</Text>

          <Text style={styles.fieldLabel}>Unit title</Text>
          <TextInput
            style={styles.titleInput}
            value={unitTitle}
            onChangeText={setUnitTitle}
            placeholder="e.g. Chapter 7 — Fractions"
          />

          {questions.map((q, i) => (
            <View key={i} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionNum}>Q{i + 1}</Text>
                <TouchableOpacity onPress={() => removeQuestion(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.questionInput}
                value={q.question}
                onChangeText={v => updateQuestion(i, 'question', v)}
                multiline
                placeholder="Question text"
              />
              {(q.options ?? []).map((opt, j) => (
                <TouchableOpacity
                  key={j}
                  style={[styles.optionRow, q.correctIndex === j && styles.optionCorrect]}
                  onPress={() => updateQuestion(i, 'correctIndex', j)}
                >
                  <Text style={styles.optionLetter}>{['A','B','C','D'][j]}</Text>
                  <TextInput
                    style={styles.optionInput}
                    value={opt}
                    onChangeText={v => {
                      const newOptions = [...q.options];
                      newOptions[j] = v;
                      updateQuestion(i, 'options', newOptions);
                    }}
                    placeholder={`Option ${['A','B','C','D'][j]}`}
                  />
                  {q.correctIndex === j && <Text style={styles.correctMark}>✓</Text>}
                </TouchableOpacity>
              ))}
              <Text style={styles.optionHint}>Tap an option to mark it as correct</Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Unit ({questions.length} questions)</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.discardBtn} onPress={reset}>
            <Text style={styles.discardBtnText}>Discard & start over</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Pick / capture image ──────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Scan a Textbook Page</Text>
        <Text style={styles.pageSubtitle}>
          Take a photo of any textbook page — AI will write 9 practice questions from it.
        </Text>

        {/* Image preview / placeholder */}
        <TouchableOpacity style={styles.imagePlaceholder} onPress={pickFromLibrary}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.placeholderInner}>
              <Text style={styles.placeholderEmoji}>📖</Text>
              <Text style={styles.placeholderText}>Tap to select a photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
            <Text style={styles.photoBtnEmoji}>📷</Text>
            <Text style={styles.photoBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={pickFromLibrary}>
            <Text style={styles.photoBtnEmoji}>🖼️</Text>
            <Text style={styles.photoBtnText}>Library</Text>
          </TouchableOpacity>
        </View>

        {image && (
          <TouchableOpacity
            style={[styles.generateBtn, loading && { opacity: 0.6 }]}
            onPress={handleGenerate}
            disabled={loading}
          >
            <Text style={styles.generateBtnText}>⚡  Generate Questions</Text>
          </TouchableOpacity>
        )}

        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            ['📖', 'Open your child\'s textbook to any page'],
            ['📷', 'Take a photo or upload from your library'],
            ['🤖', 'AI reads the page and writes 9 questions'],
            ['✏️', 'Review and edit the questions if needed'],
            ['🎮', 'Save — Bryce sees them in the app instantly'],
          ].map(([emoji, text], i) => (
            <View key={i} style={styles.howRow}>
              <Text style={styles.howEmoji}>{emoji}</Text>
              <Text style={styles.howText}>{text}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#f8fafc' },
  content:  { padding: 24, paddingBottom: 48 },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  pageTitle:    { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  pageSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 20 },

  imagePlaceholder: {
    width: '100%', aspectRatio: 4/3, backgroundColor: '#e2e8f0',
    borderRadius: 16, overflow: 'hidden', marginBottom: 16,
    borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed',
  },
  previewImage:   { width: '100%', height: '100%' },
  placeholderInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderEmoji: { fontSize: 48, marginBottom: 8 },
  placeholderText:  { fontSize: 14, color: '#94a3b8' },

  buttonRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  photoBtnEmoji: { fontSize: 20 },
  photoBtnText:  { fontSize: 15, fontWeight: '600', color: '#1e293b' },

  generateBtn: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 28,
  },
  generateBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  howItWorks: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  howTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  howRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  howEmoji: { fontSize: 22, width: 36 },
  howText:  { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },

  // Preview / edit
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  titleInput: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1e293b', marginBottom: 20,
  },
  questionCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  questionNum:    { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  removeBtn:      { backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  removeBtnText:  { fontSize: 12, fontWeight: '600', color: '#ef4444' },
  questionInput: {
    backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 10, fontSize: 14, color: '#1e293b', marginBottom: 10, minHeight: 48,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6,
  },
  optionCorrect:  { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  optionLetter:   { fontSize: 13, fontWeight: '700', color: '#64748b', width: 18 },
  optionInput:    { flex: 1, fontSize: 14, color: '#1e293b', paddingVertical: 2 },
  correctMark:    { fontSize: 16, color: '#22c55e', fontWeight: '700' },
  optionHint:     { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  saveBtn: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10, marginTop: 8,
  },
  saveBtnText:    { fontSize: 16, fontWeight: '700', color: '#fff' },
  discardBtn:     { paddingVertical: 12, alignItems: 'center' },
  discardBtnText: { fontSize: 14, color: '#ef4444', fontWeight: '600' },

  // Gate / success
  gateEmoji: { fontSize: 64, marginBottom: 16 },
  gateTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  gateDesc:  { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  gateBtn: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  gateBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  generatingTitle: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginTop: 20, marginBottom: 8 },
  generatingDesc:  { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
});
