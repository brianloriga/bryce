import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { generateQuestionsFromImage } from '../services/aiService';
import { saveCustomUnit } from '../services/supabase';

const MAX_IMAGES = 6;

export default function ScanScreen() {
  const navigation  = useNavigation();
  const { isLoggedIn } = useAuth();

  const [images, setImages]                   = useState([]);   // [{ uri, base64 }]
  const [validationError, setValidationError] = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [questions, setQuestions]             = useState(null);
  const [unitTitle, setUnitTitle]             = useState('');
  const [saving, setSaving]                   = useState(false);
  const [step, setStep]                       = useState('pick'); // 'pick' | 'generating' | 'preview' | 'saved'

  // ── Image helpers ─────────────────────────────────────────
  function addImage(asset) {
    setImages(prev => [...prev, asset]);
    setValidationError(null);
  }

  function removeImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index));
  }

  function promptImageSource() {
    Alert.alert(
      'Add a Page',
      'How would you like to add this page?',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  async function pickFromLibrary() {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum reached', `You can add up to ${MAX_IMAGES} pages per unit.`);
      return;
    }
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
    if (!result.canceled) addImage(result.assets[0]);
  }

  async function takePhoto() {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum reached', `You can add up to ${MAX_IMAGES} pages per unit.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) addImage(result.assets[0]);
  }

  // ── AI generation ─────────────────────────────────────────
  async function handleGenerate() {
    if (images.length === 0) {
      Alert.alert('No images', 'Please add at least one photo first.');
      return;
    }
    setValidationError(null);
    setStep('generating');
    setLoading(true);
    try {
      const base64Images = images.map(img => img.base64);
      const result = await generateQuestionsFromImage(base64Images);
      setUnitTitle(result.title ?? 'New Unit');
      setQuestions(result.questions ?? []);
      setStep('preview');
    } catch (err) {
      if (err.isValidationError) {
        setValidationError(err.message);
      } else {
        Alert.alert('Generation failed', err.message ?? 'Something went wrong. Please try again.');
      }
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
    setImages([]); setQuestions(null);
    setUnitTitle(''); setStep('pick'); setValidationError(null);
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
          <TouchableOpacity style={styles.gateBtn} onPress={() => navigation.navigate('Auth')}>
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
            <Text style={styles.gateBtnText}>Scan another unit</Text>
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
            {images.length > 1
              ? `AI is reading ${images.length} pages and writing practice questions.`
              : 'AI is reading the page and writing 9 practice questions.'
            }{'\n'}This takes about 10–15 seconds.
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

  // ── Pick / capture images ─────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Scan a Textbook Unit</Text>
        <Text style={styles.pageSubtitle}>
          Add one or more pages — AI will generate practice questions from the content.
        </Text>

        {/* Validation error card */}
        {validationError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorCardIcon}>⚠️</Text>
            <View style={styles.errorCardBody}>
              <Text style={styles.errorCardTitle}>Image not accepted</Text>
              <Text style={styles.errorCardDesc}>{validationError}</Text>
            </View>
            <TouchableOpacity onPress={() => setValidationError(null)} style={styles.errorCardClose}>
              <Text style={styles.errorCardCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty placeholder or image strip */}
        {images.length === 0 ? (
          <TouchableOpacity style={styles.imagePlaceholder} onPress={promptImageSource}>
            <View style={styles.placeholderInner}>
              <Text style={styles.placeholderEmoji}>📖</Text>
              <Text style={styles.placeholderText}>Tap to select a page</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.stripContainer}>
            <Text style={styles.stripLabel}>
              {images.length} page{images.length !== 1 ? 's' : ''} added
              {images.length < MAX_IMAGES ? `  ·  tap + to add more` : `  ·  maximum reached`}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {images.map((img, i) => (
                <View key={i} style={styles.thumbnail}>
                  <Image source={{ uri: img.uri }} style={styles.thumbnailImage} resizeMode="cover" />
                  <TouchableOpacity style={styles.thumbnailRemove} onPress={() => removeImage(i)}>
                    <Text style={styles.thumbnailRemoveText}>✕</Text>
                  </TouchableOpacity>
                  <View style={styles.thumbnailBadge}>
                    <Text style={styles.thumbnailBadgeText}>{i + 1}</Text>
                  </View>
                </View>
              ))}
              {images.length < MAX_IMAGES && (
                <TouchableOpacity style={styles.addPageBtn} onPress={promptImageSource}>
                  <Text style={styles.addPageBtnPlus}>+</Text>
                  <Text style={styles.addPageBtnText}>Add{'\n'}page</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {/* Camera / library buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
            <Text style={styles.photoBtnEmoji}>📷</Text>
            <Text style={styles.photoBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={pickFromLibrary}>
            <Text style={styles.photoBtnEmoji}>🖼️</Text>
            <Text style={styles.photoBtnText}>Library</Text>
          </TouchableOpacity>
        </View>

        {images.length > 0 && (
          <TouchableOpacity
            style={[styles.generateBtn, loading && { opacity: 0.6 }]}
            onPress={handleGenerate}
            disabled={loading}
          >
            <Text style={styles.generateBtnText}>
              ⚡  Generate Questions{images.length > 1 ? ` from ${images.length} pages` : ''}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            ['📖', 'Open your child\'s textbook to any page'],
            ['📷', 'Take a photo or upload from your library'],
            ['📚', 'Add multiple pages to cover a full unit'],
            ['🤖', 'AI reads the pages and writes 9 questions'],
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
  safe:    { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 48 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  pageTitle:    { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  pageSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 20 },

  // Validation error card
  errorCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fef2f2', borderRadius: 12,
    borderWidth: 1, borderColor: '#fecaca',
    padding: 14, marginBottom: 16, gap: 10,
  },
  errorCardIcon:      { fontSize: 20 },
  errorCardBody:      { flex: 1 },
  errorCardTitle:     { fontSize: 14, fontWeight: '700', color: '#dc2626', marginBottom: 2 },
  errorCardDesc:      { fontSize: 13, color: '#7f1d1d', lineHeight: 18 },
  errorCardClose:     { padding: 4 },
  errorCardCloseText: { fontSize: 14, color: '#dc2626', fontWeight: '700' },

  // Empty placeholder
  imagePlaceholder: {
    width: '100%', aspectRatio: 4/3, backgroundColor: '#e2e8f0',
    borderRadius: 16, overflow: 'hidden', marginBottom: 16,
    borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed',
  },
  placeholderInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderEmoji: { fontSize: 48, marginBottom: 8 },
  placeholderText:  { fontSize: 14, color: '#94a3b8' },

  // Image strip
  stripContainer: { marginBottom: 16 },
  stripLabel:     { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  strip:          { flexDirection: 'row', paddingBottom: 4 },

  thumbnail: {
    width: 100, height: 76, borderRadius: 10,
    marginRight: 10, position: 'relative',
  },
  thumbnailImage: { width: 100, height: 76, borderRadius: 10 },
  thumbnailRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  thumbnailRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  thumbnailBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  thumbnailBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  addPageBtn: {
    width: 100, height: 76, borderRadius: 10,
    backgroundColor: '#e2e8f0', borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addPageBtnPlus: { fontSize: 22, color: '#64748b', lineHeight: 26 },
  addPageBtnText: { fontSize: 11, color: '#64748b', textAlign: 'center', fontWeight: '600' },

  // Action buttons
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
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

  // Gate / success screens
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
