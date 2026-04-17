import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Alert, ActivityIndicator, TextInput,
  Modal, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { generateQuestionsFromImage } from '../services/aiService';
import { saveCustomUnit } from '../services/supabase';

const MAX_IMAGES = 10;
const QUESTION_OPTIONS = [5, 9, 15, 20];
const { width: SCREEN_W } = Dimensions.get('window');

const HOW_IT_WORKS = [
  { icon: 'camera-outline',      text: 'Tap Camera to photograph a textbook page, or Library to pick an existing photo' },
  { icon: 'copy-outline',        text: 'Add up to 10 pages per lesson — tap the + tile in the strip to keep going' },
  { icon: 'options-outline',     text: 'Choose how many questions to generate: 5, 9, 15, or 20' },
  { icon: 'sparkles-outline',    text: 'AI reads every page and writes the questions — takes about 10–20 seconds' },
  { icon: 'create-outline',      text: 'Review each question, edit the text, and tap any option to mark it correct' },
  { icon: 'checkmark-circle-outline', text: 'Save the lesson — it appears instantly in the Learn tab for your child to play' },
];

export default function ScanScreen() {
  const navigation  = useNavigation();
  const { isLoggedIn, activeKid } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [images, setImages]                   = useState([]);
  const [validationError, setValidationError] = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [questions, setQuestions]             = useState(null);
  const [unitTitle, setUnitTitle]             = useState('');
  const [saving, setSaving]                   = useState(false);
  const [step, setStep]                       = useState('pick');
  const [showHowModal, setShowHowModal]       = useState(false);
  const [questionCount, setQuestionCount]     = useState(9);

  // ── Image helpers ──────────────────────────────────────────
  function addImage(asset) {
    setImages(prev => [...prev, asset]);
    setValidationError(null);
  }
  function removeImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index));
  }

  async function pickFromLibrary() {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum reached', `You can add up to ${MAX_IMAGES} pages per lesson.`);
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
      Alert.alert('Maximum reached', `You can add up to ${MAX_IMAGES} pages per lesson.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    if (!result.canceled) addImage(result.assets[0]);
  }

  // ── AI generation ──────────────────────────────────────────
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
      const result = await generateQuestionsFromImage(base64Images, questionCount);
      setUnitTitle(result.title ?? 'New Lesson');
      setQuestions(result.questions ?? []);
      setStep('preview');
    } catch (err) {
      if (err.isValidationError) {
        setImages([]);
        setValidationError(err.message);
      } else {
        Alert.alert('Generation failed', err.message ?? 'Something went wrong. Please try again.');
      }
      setStep('pick');
    } finally {
      setLoading(false);
    }
  }

  // ── Edit helpers ───────────────────────────────────────────
  function updateQuestion(index, field, value) {
    setQuestions(prev => prev.map((q, i) =>
      i === index ? { ...q, [field]: value } : q
    ));
  }
  function removeQuestion(index) {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  }

  // ── Save ───────────────────────────────────────────────────
  async function handleSave() {
    if (!unitTitle.trim()) { Alert.alert('Title required', 'Please give this lesson a name.'); return; }
    if (!questions || questions.length === 0) { Alert.alert('No questions', 'Add at least one question before saving.'); return; }
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

  // ── Not logged in ──────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={theme.statusBar} />
        <View style={styles.gate}>
          <View style={styles.gateIconCircle}>
            <Ionicons name="camera" size={44} color="#4ade80" />
          </View>
          <Text style={styles.gateTitle}>Sign in to scan</Text>
          <Text style={styles.gateDesc}>
            Create a parent account to photograph textbook pages and generate custom practice questions.
          </Text>
          <TouchableOpacity style={styles.gateBtn} onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.gateBtnText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Saved ──────────────────────────────────────────────────
  if (step === 'saved') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={theme.statusBar} />
        <View style={styles.gate}>
          <View style={[styles.gateIconCircle, { backgroundColor: 'rgba(74,222,128,0.15)' }]}>
            <Ionicons name="checkmark-circle" size={44} color="#4ade80" />
          </View>
          <Text style={styles.gateTitle}>Lesson saved!</Text>
          <Text style={styles.gateDesc}>
            "{unitTitle}" is ready.{'\n'}{activeKid?.name ?? 'Your child'} will see it in the Learn tab.
          </Text>
          <TouchableOpacity style={styles.gateBtn} onPress={reset}>
            <Text style={styles.gateBtnText}>Scan another lesson</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.learnBtn}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
          >
            <Ionicons name="school-outline" size={18} color={theme.accent} style={{ marginRight: 8 }} />
            <Text style={styles.learnBtnText}>Go to Learn</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Generating ─────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={theme.statusBar} />
        <View style={styles.gate}>
          <ActivityIndicator size="large" color="#4ade80" />
          <Text style={styles.generatingTitle}>Generating questions…</Text>
          <Text style={styles.generatingDesc}>
            {images.length > 1
              ? `Reading ${images.length} pages and writing ${questionCount} questions.`
              : `Reading the page and writing ${questionCount} practice questions.`
            }{'\n'}This takes about 10–20 seconds.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Preview / Edit ─────────────────────────────────────────
  if (step === 'preview' && questions) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={theme.statusBar} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
        <ScrollView contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.previewTitle}>Review Questions</Text>
          <Text style={styles.previewSub}>Edit or remove any questions before saving.</Text>

          <Text style={styles.fieldLabel}>Lesson title</Text>
          <TextInput
            style={styles.titleInput}
            value={unitTitle}
            onChangeText={setUnitTitle}
            placeholder="e.g. Chapter 7 — Fractions"
            placeholderTextColor="#64748b"
          />

          {questions.map((q, i) => (
            <View key={i} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionNum}>Q{i + 1}</Text>
                <TouchableOpacity onPress={() => removeQuestion(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.questionInput}
                value={q.question}
                onChangeText={v => updateQuestion(i, 'question', v)}
                multiline
                placeholder="Question text"
                placeholderTextColor="#64748b"
              />
              {(q.options ?? []).map((opt, j) => (
                <TouchableOpacity
                  key={j}
                  style={[styles.optionRow, q.correctIndex === j && styles.optionCorrect]}
                  onPress={() => updateQuestion(i, 'correctIndex', j)}
                >
                  <Text style={[styles.optionLetter, q.correctIndex === j && styles.optionLetterActive]}>
                    {['A','B','C','D'][j]}
                  </Text>
                  <TextInput
                    style={[styles.optionInput, q.correctIndex === j && styles.optionInputActive]}
                    value={opt}
                    onChangeText={v => {
                      const newOptions = [...q.options];
                      newOptions[j] = v;
                      updateQuestion(i, 'options', newOptions);
                    }}
                    placeholder={`Option ${['A','B','C','D'][j]}`}
                    placeholderTextColor="#475569"
                  />
                  {q.correctIndex === j && (
                    <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
                  )}
                </TouchableOpacity>
              ))}
              <Text style={styles.optionHint}>Tap an option to mark it correct</Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.generateBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#0f172a" />
              : <Text style={styles.generateBtnText}>Save Lesson · {questions.length} questions</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.discardBtn} onPress={reset}>
            <Text style={styles.discardBtnText}>Discard & start over</Text>
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Pick / Capture ─────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Scan a Lesson</Text>
          <TouchableOpacity onPress={() => setShowHowModal(true)} style={styles.howLink}>
            <Text style={styles.howLinkText}>How it works</Text>
            <Ionicons name="information-circle-outline" size={16} color="#4ade80" />
          </TouchableOpacity>
        </View>

        {/* Validation error */}
        {validationError && (
          <View style={styles.errorCard}>
            <Ionicons name="warning" size={20} color="#f87171" style={{ flexShrink: 0 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorCardTitle}>Image not accepted</Text>
              <Text style={styles.errorCardDesc}>{validationError}</Text>
            </View>
            <TouchableOpacity onPress={() => setValidationError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color="#f87171" />
            </TouchableOpacity>
          </View>
        )}

        {/* Hero camera / library buttons — shown when no images yet */}
        {images.length === 0 && (
          <View style={styles.heroRow}>
            <TouchableOpacity style={styles.heroBtn} onPress={takePhoto} activeOpacity={0.8}>
              <View style={[styles.heroIconCircle, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
                <Ionicons name="camera" size={36} color="#4ade80" />
              </View>
              <Text style={styles.heroBtnLabel}>Camera</Text>
              <Text style={styles.heroBtnSub}>Take a photo now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.heroBtn} onPress={pickFromLibrary} activeOpacity={0.8}>
              <View style={[styles.heroIconCircle, { backgroundColor: 'rgba(192,132,252,0.12)' }]}>
                <Ionicons name="images" size={36} color="#c084fc" />
              </View>
              <Text style={styles.heroBtnLabel}>Library</Text>
              <Text style={styles.heroBtnSub}>Choose existing photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Thumbnail strip — shown when images are added */}
        {images.length > 0 && (
          <View style={styles.stripSection}>
            <View style={styles.stripHeader}>
              <Text style={styles.stripCount}>
                {images.length} / {MAX_IMAGES} pages
              </Text>
              {images.length < MAX_IMAGES && (
                <Text style={styles.stripHint}>tap + to add more</Text>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {images.map((img, i) => (
                <View key={i} style={styles.thumbnail}>
                  <Image source={{ uri: img.uri }} style={styles.thumbnailImage} resizeMode="cover" />
                  {/* X inside the image, top-right corner */}
                  <TouchableOpacity
                    style={styles.thumbnailRemove}
                    onPress={() => removeImage(i)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.thumbnailBadge}>
                    <Text style={styles.thumbnailBadgeText}>{i + 1}</Text>
                  </View>
                </View>
              ))}

              {images.length < MAX_IMAGES && (
                <TouchableOpacity style={styles.addPageBtn} onPress={takePhoto} activeOpacity={0.7}>
                  <Ionicons name="add" size={28} color="#4ade80" />
                  <Text style={styles.addPageText}>Add page</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Smaller camera/library row once images exist */}
            <View style={styles.addMoreRow}>
              <TouchableOpacity style={styles.addMoreBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={18} color="#94a3b8" />
                <Text style={styles.addMoreText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addMoreBtn} onPress={pickFromLibrary}>
                <Ionicons name="images-outline" size={18} color="#94a3b8" />
                <Text style={styles.addMoreText}>Library</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Question count picker + Generate button */}
        {images.length > 0 && (
          <>
            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>Questions to generate</Text>
              <View style={styles.pickerRow}>
                {QUESTION_OPTIONS.map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.pickerOption, questionCount === n && styles.pickerOptionActive]}
                    onPress={() => setQuestionCount(n)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.pickerOptionText, questionCount === n && styles.pickerOptionTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.generateBtn, loading && { opacity: 0.6 }]}
              onPress={handleGenerate}
              disabled={loading}
            >
              <Text style={styles.generateBtnText}>
                Generate {questionCount} Questions{images.length > 1 ? ` · ${images.length} pages` : ''}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Subtle prompt when no images */}
        {images.length === 0 && (
          <Text style={styles.promptText}>
            Photograph any textbook page — AI will write 9 practice questions from the content.
          </Text>
        )}

      </ScrollView>

      {/* How it works modal */}
      <Modal
        visible={showHowModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHowModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How it works</Text>
              <TouchableOpacity onPress={() => setShowHowModal(false)}>
                <Ionicons name="close" size={22} color={theme.textSub} />
              </TouchableOpacity>
            </View>

            {HOW_IT_WORKS.map((step, i) => (
              <View key={i} style={styles.howRow}>
                <View style={styles.howIconCircle}>
                  <Ionicons name={step.icon} size={20} color="#4ade80" />
                </View>
                <Text style={styles.howText}>{step.text}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowHowModal(false)}>
              <Text style={styles.modalCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(t) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: t.bg },
    content: { padding: 24, paddingBottom: 60 },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 28,
    },
    pageTitle: { fontSize: 28, fontWeight: '900', color: t.text },
    howLink: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: t.accentDim, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    howLinkText: { fontSize: 13, fontWeight: '600', color: t.accent },

    // Gate / success / generating
    gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
    gateIconCircle: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: t.accentDim,
      alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    },
    gateTitle: { fontSize: 26, fontWeight: '900', color: t.text, marginBottom: 10, textAlign: 'center' },
    gateDesc:  { fontSize: 15, color: t.textSub, textAlign: 'center', lineHeight: 24, marginBottom: 28 },
    gateBtn: {
      backgroundColor: '#16a34a', borderRadius: 16,
      paddingHorizontal: 32, paddingVertical: 16,
      shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 10,
    },
    gateBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    learnBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      marginTop: 14, paddingVertical: 12, paddingHorizontal: 24,
      borderRadius: 14, borderWidth: 1.5, borderColor: t.accent,
      backgroundColor: t.accentDim,
    },
    learnBtnText: { fontSize: 15, fontWeight: '700', color: t.accent },
    generatingTitle: { fontSize: 22, fontWeight: '800', color: t.text, marginTop: 24, marginBottom: 10 },
    generatingDesc:  { fontSize: 14, color: t.textSub, textAlign: 'center', lineHeight: 22 },

    // Validation error
    errorCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: t.dangerDim,
      borderRadius: 14, borderWidth: 1, borderColor: t.danger + '40',
      padding: 14, marginBottom: 20,
    },
    errorCardTitle: { fontSize: 14, fontWeight: '700', color: t.danger, marginBottom: 3 },
    errorCardDesc:  { fontSize: 13, color: t.textSub, lineHeight: 18 },

    // Hero buttons
    heroRow: { flexDirection: 'row', gap: 14, marginBottom: 28 },
    heroBtn: {
      flex: 1, backgroundColor: t.bgCard,
      borderRadius: 20, padding: 22, alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
    },
    heroIconCircle: {
      width: 68, height: 68, borderRadius: 34,
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    heroBtnLabel: { fontSize: 17, fontWeight: '800', color: t.text, marginBottom: 4 },
    heroBtnSub:   { fontSize: 12, color: t.textMuted, textAlign: 'center' },

    promptText: {
      fontSize: 14, color: t.textMuted,
      textAlign: 'center', lineHeight: 21, marginTop: 4,
    },

    // Thumbnail strip
    stripSection: { marginBottom: 24 },
    stripHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 12,
    },
    stripCount: { fontSize: 13, fontWeight: '700', color: t.textSub },
    stripHint:  { fontSize: 12, color: t.textMuted },
    strip: { flexDirection: 'row', paddingBottom: 4, gap: 10 },

    thumbnail: {
      width: 110, height: 84, borderRadius: 12,
      overflow: 'hidden', position: 'relative',
    },
    thumbnailImage: { width: 110, height: 84 },
    thumbnailRemove: {
      position: 'absolute', top: 6, right: 6,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center', justifyContent: 'center',
    },
    thumbnailBadge: {
      position: 'absolute', bottom: 6, left: 6,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    thumbnailBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    addPageBtn: {
      width: 110, height: 84, borderRadius: 12,
      backgroundColor: t.accentDim,
      borderWidth: 1.5, borderColor: t.accent + '50', borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    addPageText: { fontSize: 11, color: t.accent, fontWeight: '600' },

    addMoreRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    addMoreBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 7, backgroundColor: t.bgInput,
      borderRadius: 12, paddingVertical: 11,
      borderWidth: 1, borderColor: t.border,
    },
    addMoreText: { fontSize: 14, fontWeight: '600', color: t.textSub },

    // Question count picker
    pickerSection: { marginBottom: 16 },
    pickerLabel: {
      fontSize: 11, fontWeight: '700', color: t.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
    },
    pickerRow: { flexDirection: 'row', gap: 10 },
    pickerOption: {
      flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
      backgroundColor: t.bgInput,
      borderWidth: 1.5, borderColor: t.border,
    },
    pickerOptionActive: {
      backgroundColor: t.accentDim,
      borderColor: t.accent,
    },
    pickerOptionText:       { fontSize: 16, fontWeight: '700', color: t.textMuted },
    pickerOptionTextActive: { color: t.accent },

    // Generate button
    generateBtn: {
      backgroundColor: '#16a34a', borderRadius: 16,
      paddingVertical: 18, alignItems: 'center',
      shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
    },
    generateBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },

    // How it works modal
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: t.bgCard,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: 24, paddingBottom: 40,
      borderWidth: 1, borderColor: t.border,
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: t.borderStrong,
      alignSelf: 'center', marginBottom: 20,
    },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: t.text },

    howRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
    howIconCircle: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: t.accentDim,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    howText: { flex: 1, fontSize: 14, color: t.textSub, lineHeight: 20 },

    modalCloseBtn: {
      backgroundColor: '#16a34a', borderRadius: 14,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
    },
    modalCloseBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    // Preview / edit
    previewContent: { padding: 20, paddingBottom: 60, backgroundColor: t.bg },
    previewTitle: { fontSize: 26, fontWeight: '900', color: t.text, marginBottom: 4 },
    previewSub:   { fontSize: 14, color: t.textMuted, marginBottom: 24 },

    fieldLabel: {
      fontSize: 11, fontWeight: '700', color: t.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
    },
    titleInput: {
      backgroundColor: t.bgCard, borderRadius: 12,
      borderWidth: 1, borderColor: t.border,
      paddingHorizontal: 14, paddingVertical: 13,
      fontSize: 16, color: t.text, marginBottom: 20,
    },
    questionCard: {
      backgroundColor: t.bgCard, borderRadius: 16, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: t.border,
    },
    questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    questionNum:    { fontSize: 13, fontWeight: '800', color: t.accent, letterSpacing: 0.5 },
    removeBtn:      { backgroundColor: t.dangerDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    removeBtnText:  { fontSize: 12, fontWeight: '700', color: t.danger },
    questionInput: {
      backgroundColor: t.bgInput, borderRadius: 10,
      borderWidth: 1, borderColor: t.border,
      padding: 10, fontSize: 14, color: t.text, marginBottom: 10, minHeight: 48,
    },
    optionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: t.bgInput,
      borderRadius: 10, borderWidth: 1.5, borderColor: t.border,
      paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6,
    },
    optionCorrect:      { borderColor: t.accent, backgroundColor: t.accentDim },
    optionLetter:       { fontSize: 13, fontWeight: '700', color: t.textMuted, width: 18 },
    optionLetterActive: { color: t.accent },
    optionInput:        { flex: 1, fontSize: 14, color: t.text, paddingVertical: 2 },
    optionInputActive:  { color: t.text },
    optionHint:         { fontSize: 11, color: t.textMuted, marginTop: 4 },

    discardBtn:     { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    discardBtnText: { fontSize: 14, color: t.danger, fontWeight: '600' },
  });
}
