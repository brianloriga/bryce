import React, { useState, useMemo, useRef } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
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
import { generateQuestionsFromImage, regenerateQuestion, generateAudio } from '../services/aiService';
import { saveCustomUnit } from '../services/supabase';
import { DEFAULT_SUBJECTS } from '../utils/subjects';

const MAX_IMAGES = 10;

// Resize any captured image to a max width of 1024px and compress to JPEG 0.7.
// An iPhone 14 photo at full res is ~4000px wide and 2-4MB. After resize it drops
// to ~80-150KB — well within the 6MB Edge Function body limit even with 10 pages.
// GPT-4o reads printed textbook text perfectly at 1024px.
async function resizeForUpload(uri, maxWidth = 1024) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return result; // { uri, base64, width, height }
}
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

  const [images, setImages]                       = useState([]);
  // visualImages is an array of { uri, base64, questionCount } — one per visual aid slot
  const [visualImages, setVisualImages]           = useState([]);
  const [validationError, setValidationError]     = useState(null);
  const [loading, setLoading]                     = useState(false);
  const [questions, setQuestions]                 = useState(null);
  const [passage, setPassage]                     = useState(null);
  const [unitTitle, setUnitTitle]                 = useState('');
  const [saving, setSaving]                       = useState(false);
  const [step, setStep]                           = useState('pick');
  const [showHowModal, setShowHowModal]           = useState(false);
  const [questionCount, setQuestionCount]         = useState(9);
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);
  // Subject selection
  const [selectedSubject, setSelectedSubject]     = useState(null);
  const [creatingSubject, setCreatingSubject]     = useState(false);
  const [newSubjectName, setNewSubjectName]       = useState('');
  const cancelledRef = useRef(false);

  function cancelGeneration() {
    cancelledRef.current = true;
    setStep('pick');
    setLoading(false);
  }

  // How many visual aid slots are available for this question count
  function maxVisualSlots(qCount) {
    if (qCount >= 20) return 3;
    if (qCount >= 15) return 2;
    return 1;
  }

  function setVisualSlotImage(slotIdx, asset) {
    setVisualImages(prev => {
      const next = [...prev];
      next[slotIdx] = {
        ...asset,
        questionCount: prev[slotIdx]?.questionCount ?? 1,
      };
      return next;
    });
  }

  function setVisualSlotQCount(slotIdx, count) {
    setVisualImages(prev => prev.map((item, i) =>
      i === slotIdx ? { ...item, questionCount: count } : item,
    ));
  }

  function removeVisualSlot(slotIdx) {
    setVisualImages(prev => {
      const next = [...prev];
      next.splice(slotIdx, 1);
      return next;
    });
  }

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
      quality: 1,
    });
    if (!result.canceled) {
      const resized = await resizeForUpload(result.assets[0].uri);
      addImage({ ...result.assets[0], uri: resized.uri, base64: resized.base64 });
    }
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
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled) {
      const resized = await resizeForUpload(result.assets[0].uri);
      addImage({ ...result.assets[0], uri: resized.uri, base64: resized.base64 });
    }
  }

  // ── Visual Aid capture ─────────────────────────────────────
  // Tips shown via Alert.alert (not a Modal) so there is zero iOS view-controller
  // conflict when the camera/library launches immediately in the button's onPress.
  // Quality capped at 0.65 so the base64 payload stays within the ~6MB Edge Function limit.

  function showVisualCaptureTips(source, slotIdx) {
    const tips =
      '⚡ Flash ON — removes shadows your phone casts.\n\n' +
      '✂️ You\'ll get a crop tool after the photo — drag the corners to frame just the diagram.\n\n' +
      '📐 Hold directly above the page — no angle.\n\n' +
      '☀️ Good natural light also works.';
    Alert.alert(
      '📸 Photo Tips',
      tips,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: source === 'camera' ? 'Open Camera' : 'Choose Photo',
          onPress: () => source === 'camera'
            ? openVisualCamera(slotIdx)
            : openVisualLibrary(slotIdx),
        },
      ],
    );
  }

  async function openVisualCamera(slotIdx = 0) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: true });
    if (!result.canceled) {
      const resized = await resizeForUpload(result.assets[0].uri, 1024);
      setVisualSlotImage(slotIdx, { ...result.assets[0], uri: resized.uri, base64: resized.base64 });
    }
  }

  async function openVisualLibrary(slotIdx = 0) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
    });
    if (!result.canceled) {
      const resized = await resizeForUpload(result.assets[0].uri, 1024);
      setVisualSlotImage(slotIdx, { ...result.assets[0], uri: resized.uri, base64: resized.base64 });
    }
  }

  // ── AI generation ──────────────────────────────────────────
  async function handleGenerate() {
    if (images.length === 0) {
      Alert.alert('No images', 'Please add at least one photo first.');
      return;
    }
    setValidationError(null);
    cancelledRef.current = false;
    setStep('generating');
    setLoading(true);
    try {
      const base64Images = images.map(img => img.base64);
      const activeVisuals = visualImages
        .slice(0, maxVisualSlots(questionCount))
        .filter(v => v?.base64)
        .map(v => ({ base64: v.base64, questionCount: v.questionCount ?? 1 }));

      const result = await generateQuestionsFromImage(
        base64Images,
        questionCount,
        activeVisuals,
      );

      // User cancelled while waiting — discard result and stay on pick
      if (cancelledRef.current) return;

      setUnitTitle(result.title ?? 'New Lesson');
      setQuestions(result.questions ?? []);
      setPassage(result.passage ?? null);
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

  async function handleRegenerate(index) {
    if (regeneratingIndex !== null) return;
    const existing = questions[index];
    setRegeneratingIndex(index);
    try {
      const replacement = await regenerateQuestion(
        images.map(img => img.base64),
        existing.question,
        existing.type === 'visual_mc',
      );
      setQuestions(prev => prev.map((q, i) => i === index ? replacement : q));
    } catch (err) {
      Alert.alert('Regeneration failed', err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setRegeneratingIndex(null);
    }
  }

  // ── Save ───────────────────────────────────────────────────
  async function handleSave() {
    if (!unitTitle.trim()) { Alert.alert('Title required', 'Please give this lesson a name.'); return; }
    if (!questions || questions.length === 0) { Alert.alert('No questions', 'Add at least one question before saving.'); return; }

    // If the parent is mid-way through creating a custom subject, finalise it
    let subjectKey = selectedSubject;
    if (creatingSubject) {
      const trimmed = newSubjectName.trim();
      if (!trimmed) { Alert.alert('Subject name required', 'Please enter a name for your subject, or choose an existing one.'); return; }
      // Convert to a stable snake_case key
      subjectKey = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    setSaving(true);
    try {
      const saved = await saveCustomUnit(unitTitle.trim(), questions, null, passage, subjectKey);
      setStep('saved');
      // Fire-and-forget: generate TTS audio in the background after save succeeds.
      generateAudio(saved.id, questions).catch(() => {});
    } catch (err) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setImages([]); setVisualImages([]); setQuestions(null);
    setPassage(null); setUnitTitle(''); setStep('pick'); setValidationError(null);
    setSelectedSubject(null); setCreatingSubject(false); setNewSubjectName('');
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
            }
            {visualImages.filter(v => v?.base64).length > 0
              ? `\nIncluding ${visualImages.filter(v => v?.base64).length} visual aid image${visualImages.filter(v => v?.base64).length > 1 ? 's' : ''}.`
              : ''}
            {'\n'}This takes about 10–20 seconds.
          </Text>
          <TouchableOpacity
            style={styles.cancelGenerateBtn}
            onPress={cancelGeneration}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelGenerateBtnText}>Cancel</Text>
          </TouchableOpacity>
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

          {/* ── Subject picker ── */}
          <Text style={styles.fieldLabel}>Subject</Text>
          <View style={styles.subjectGrid}>
            {DEFAULT_SUBJECTS.map(s => {
              const active = selectedSubject === s.key && !creatingSubject;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.subjectChip,
                    { borderColor: s.color },
                    active && { backgroundColor: s.color },
                  ]}
                  onPress={() => { setSelectedSubject(s.key); setCreatingSubject(false); setNewSubjectName(''); }}
                  activeOpacity={0.78}
                >
                  <Image source={s.image} style={styles.subjectChipIcon} resizeMode="contain" />
                  <Text style={[styles.subjectChipLabel, active && styles.subjectChipLabelActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Create your own subject */}
            <TouchableOpacity
              style={[
                styles.subjectChip,
                styles.subjectChipCustom,
                creatingSubject && styles.subjectChipCustomActive,
              ]}
              onPress={() => { setCreatingSubject(true); setSelectedSubject(null); }}
              activeOpacity={0.78}
            >
              <Ionicons name="add" size={15} color={creatingSubject ? '#fff' : '#94a3b8'} />
              <Text style={[styles.subjectChipLabel, creatingSubject && styles.subjectChipLabelActive]}>
                {creatingSubject ? 'New subject' : 'Create your own'}
              </Text>
            </TouchableOpacity>
          </View>

          {creatingSubject && (
            <TextInput
              style={[styles.titleInput, { marginTop: 8 }]}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              placeholder="e.g. Spanish, Art, Health…"
              placeholderTextColor="#64748b"
              autoFocus
              returnKeyType="done"
            />
          )}

          {!selectedSubject && !creatingSubject && (
            <Text style={styles.subjectSkipHint}>
              No subject selected — lesson will appear in "Unassigned"
            </Text>
          )}

          {passage && (
            <View style={styles.passagePreviewCard}>
              <View style={styles.passagePreviewHeader}>
                <Text style={styles.passagePreviewIcon}>📖</Text>
                <Text style={styles.passagePreviewTitle}>Reading Passage Detected</Text>
              </View>
              <Text style={styles.passagePreviewNote}>
                Students will be able to tap "Read Passage" during the quiz to reference this text.
              </Text>
              <Text style={styles.passagePreviewText} numberOfLines={4}>{passage}</Text>
            </View>
          )}

          {questions.map((q, i) => {
            const qType = q.type ?? 'multiple_choice';
            const TYPE_LABEL = {
              fill_in: 'Fill in the Blank', ordering: 'Ordering', true_false: 'True / False',
              word_bank: 'Word Bank', visual_mc: 'Visual MC', multiple_choice: 'Multiple Choice',
            };
            return (
            <View key={i} style={styles.questionCard}>
              {/* Header row */}
              <View style={styles.questionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.questionNum}>Q{i + 1}</Text>
                  <View style={styles.qTypeBadge}>
                    <Text style={styles.qTypeBadgeText}>{TYPE_LABEL[qType] ?? qType}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity onPress={() => handleRegenerate(i)} style={styles.regenBtn} disabled={regeneratingIndex !== null}>
                    {regeneratingIndex === i
                      ? <ActivityIndicator size="small" color="#60a5fa" />
                      : <Ionicons name="refresh-outline" size={18} color="#60a5fa" />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeQuestion(i)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Question text — editable for all types */}
              <TextInput
                style={styles.questionInput}
                value={q.question}
                onChangeText={v => updateQuestion(i, 'question', v)}
                multiline
                placeholder="Question text"
                placeholderTextColor="#64748b"
              />

              {/* ── Type-specific fields ── */}

              {/* Multiple choice / visual_mc */}
              {(!q.type || q.type === 'multiple_choice' || q.type === 'visual_mc') && (
                <>
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
                        onChangeText={v => { const o = [...q.options]; o[j] = v; updateQuestion(i, 'options', o); }}
                        placeholder={`Option ${['A','B','C','D'][j]}`}
                        placeholderTextColor="#475569"
                      />
                      {q.correctIndex === j && <Ionicons name="checkmark-circle" size={18} color="#4ade80" />}
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.optionHint}>Tap an option to mark it correct</Text>
                </>
              )}

              {/* Fill in the blank */}
              {q.type === 'fill_in' && (
                <View style={styles.reviewFieldGroup}>
                  <Text style={styles.reviewFieldLabel}>Correct answer</Text>
                  <TextInput
                    style={styles.reviewFieldInput}
                    value={q.correctAnswer ?? ''}
                    onChangeText={v => updateQuestion(i, 'correctAnswer', v)}
                    placeholder="e.g. 0.3"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.reviewFieldLabel}>Also accept (comma-separated variants)</Text>
                  <TextInput
                    style={styles.reviewFieldInput}
                    value={(q.acceptedAnswers ?? []).join(', ')}
                    onChangeText={v => updateQuestion(i, 'acceptedAnswers', v.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="e.g. .3, 0.30"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              {/* Ordering */}
              {q.type === 'ordering' && (
                <View style={styles.reviewFieldGroup}>
                  <Text style={styles.reviewFieldLabel}>Items to order (one per line)</Text>
                  <TextInput
                    style={[styles.reviewFieldInput, { minHeight: 80 }]}
                    value={(q.items ?? []).join('\n')}
                    onChangeText={v => updateQuestion(i, 'items', v.split('\n').map(s => s.trim()).filter(Boolean))}
                    multiline
                    placeholder={'1/4\n1/2\n3/4'}
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.reviewFieldLabel}>Correct order (item numbers, comma-separated)</Text>
                  <TextInput
                    style={styles.reviewFieldInput}
                    value={(q.correctOrder ?? []).map(n => n + 1).join(', ')}
                    onChangeText={v => {
                      const nums = v.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(n => !isNaN(n));
                      updateQuestion(i, 'correctOrder', nums);
                    }}
                    placeholder="e.g. 1, 3, 2, 4"
                    placeholderTextColor="#475569"
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.optionHint}>
                    Enter item numbers in the correct order (first item = 1)
                  </Text>
                </View>
              )}

              {/* True / False */}
              {q.type === 'true_false' && (
                <View style={styles.reviewFieldGroup}>
                  <Text style={styles.reviewFieldLabel}>Correct answer</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.tfEditBtn, q.correctAnswer === true && styles.tfEditBtnTrue]}
                      onPress={() => updateQuestion(i, 'correctAnswer', true)}
                    >
                      <Text style={[styles.tfEditBtnText, q.correctAnswer === true && { color: '#fff' }]}>True</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tfEditBtn, q.correctAnswer === false && styles.tfEditBtnFalse]}
                      onPress={() => updateQuestion(i, 'correctAnswer', false)}
                    >
                      <Text style={[styles.tfEditBtnText, q.correctAnswer === false && { color: '#fff' }]}>False</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Word bank */}
              {q.type === 'word_bank' && (
                <View style={styles.reviewFieldGroup}>
                  <Text style={styles.reviewFieldLabel}>Word bank (comma-separated)</Text>
                  <TextInput
                    style={styles.reviewFieldInput}
                    value={(q.wordBank ?? []).join(', ')}
                    onChangeText={v => updateQuestion(i, 'wordBank', v.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="e.g. am, is, are"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.reviewFieldLabel}>Correct answer</Text>
                  <TextInput
                    style={styles.reviewFieldInput}
                    value={q.correctAnswer ?? ''}
                    onChangeText={v => updateQuestion(i, 'correctAnswer', v.trim())}
                    placeholder="e.g. is"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
            </View>
            );
          })}

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

        {/* Subtle prompt when no images yet */}
        {images.length === 0 && (
          <Text style={styles.promptText}>
            Photograph any textbook page — AI will write practice questions from the content.
          </Text>
        )}

        {/* Question count picker — shown after first image is added */}
        {images.length > 0 && (
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
        )}

        {/* Visual Aid section — shown once pages are added */}
        {images.length > 0 && (
          <View style={styles.visualSection}>
            <View style={styles.visualSectionHeader}>
              <View style={styles.visualSectionHeaderLeft}>
                <Ionicons name="image-outline" size={18} color="#c084fc" />
                <Text style={styles.visualSectionTitle}>Visual Aid Photos</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalBadgeText}>optional</Text>
                </View>
              </View>
            </View>

            <Text style={styles.visualDesc}>
              Have a diagram, chart, or graph? Add up to {maxVisualSlots(questionCount)} photo{maxVisualSlots(questionCount) > 1 ? 's' : ''} and choose how many questions to ask about each one.
            </Text>

            {Array.from({ length: maxVisualSlots(questionCount) }).map((_, slotIdx) => {
              const vImg = visualImages[slotIdx];
              return (
                <View key={slotIdx} style={styles.visualSlotCard}>
                  <View style={styles.visualSlotCardHeader}>
                    <View style={styles.visualSlotBadge}>
                      <Text style={styles.visualSlotBadgeText}>{slotIdx + 1}</Text>
                    </View>
                    <Text style={styles.visualSlotCardTitle}>
                      {vImg ? 'Visual Aid Added' : 'Visual Aid (optional)'}
                    </Text>
                    {vImg && (
                      <TouchableOpacity onPress={() => removeVisualSlot(slotIdx)} style={{ marginLeft: 'auto' }}>
                        <Text style={styles.visualRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {!vImg ? (
                    <View style={styles.visualBtnRow}>
                      <TouchableOpacity
                        style={styles.visualCaptureBtn}
                        onPress={() => showVisualCaptureTips('camera', slotIdx)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera-outline" size={17} color="#c084fc" />
                        <Text style={styles.visualCaptureBtnText}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.visualCaptureBtn}
                        onPress={() => openVisualLibrary(slotIdx)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="images-outline" size={17} color="#c084fc" />
                        <Text style={styles.visualCaptureBtnText}>From Library</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.visualSlotFilled}>
                      <Image
                        source={{ uri: vImg.uri }}
                        style={styles.visualSlotThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.visualSlotInfo}>
                        <Text style={styles.visualSlotQLabel}>Questions from this image:</Text>
                        <View style={styles.visualSlotQRow}>
                          {[1, 2, 3].map(n => (
                            <TouchableOpacity
                              key={n}
                              style={[styles.visualQOption, vImg.questionCount === n && styles.visualQOptionActive]}
                              onPress={() => setVisualSlotQCount(slotIdx, n)}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.visualQOptionText, vImg.questionCount === n && styles.visualQOptionTextActive]}>
                                {n}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TouchableOpacity
                          style={styles.visualRetakeBtn}
                          onPress={() => showVisualCaptureTips('camera', slotIdx)}
                        >
                          <Text style={styles.visualRetakeBtnText}>Retake</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Generate button + cancel */}
        {images.length > 0 && (
          <>
            <TouchableOpacity
              style={[styles.generateBtn, loading && { opacity: 0.6 }]}
              onPress={handleGenerate}
              disabled={loading}
            >
              <Text style={styles.generateBtnText}>
                Generate {questionCount} Questions{images.length > 1 ? ` · ${images.length} pages` : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.discardBtn}
              onPress={() =>
                Alert.alert(
                  'Start Over?',
                  'This will remove all your photos and start fresh.',
                  [
                    { text: 'Keep Working', style: 'cancel' },
                    { text: 'Start Over', style: 'destructive', onPress: reset },
                  ],
                )
              }
            >
              <Text style={styles.discardBtnText}>Cancel & Start Over</Text>
            </TouchableOpacity>
          </>
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

    // Visual Aid section
    visualSection: {
      backgroundColor: t.bgCard,
      borderRadius: 16, borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)',
      padding: 16, marginBottom: 20,
    },
    visualSectionHeader: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 10,
    },
    visualSectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    visualSectionTitle:  { fontSize: 14, fontWeight: '800', color: '#c084fc' },
    optionalBadge: {
      backgroundColor: 'rgba(192,132,252,0.15)',
      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    },
    optionalBadgeText:  { fontSize: 10, fontWeight: '700', color: '#c084fc' },
    visualRemoveText:   { fontSize: 13, fontWeight: '600', color: t.danger },
    visualDesc: { fontSize: 13, color: t.textSub, lineHeight: 19, marginBottom: 12 },
    visualBtnRow: { flexDirection: 'row', gap: 10 },
    visualCaptureBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 7, backgroundColor: 'rgba(192,132,252,0.1)',
      borderRadius: 12, paddingVertical: 11,
      borderWidth: 1.5, borderColor: 'rgba(192,132,252,0.35)',
    },
    visualCaptureBtnText: { fontSize: 13, fontWeight: '700', color: '#c084fc' },
    visualPreviewRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    visualThumbnail: {
      width: 90, height: 90, borderRadius: 12, backgroundColor: t.bgInput,
    },
    visualPreviewInfo: { flex: 1, gap: 3 },
    visualPreviewLabel: { fontSize: 14, fontWeight: '800', color: t.text },
    visualPreviewSub:   { fontSize: 12, color: t.textSub, lineHeight: 17 },
    visualRetakeBtn: {
      alignSelf: 'flex-start', marginTop: 6,
      backgroundColor: 'rgba(192,132,252,0.12)',
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
      borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)',
    },
    visualRetakeBtnText: { fontSize: 12, fontWeight: '700', color: '#c084fc' },
    tipsIntro:    { fontSize: 14, color: t.textSub, lineHeight: 20, marginBottom: 16 },
    tipsBtnRow:   { flexDirection: 'row', gap: 10, marginTop: 8 },
    tipsLibraryBtn: {
      flex: 1, backgroundColor: t.bgCard,
      borderWidth: 1.5, borderColor: '#7c3aed',
    },

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

    // Subject picker
    subjectGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6,
    },
    subjectChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 13, paddingVertical: 9,
      borderRadius: 12, borderWidth: 1.5,
      backgroundColor: 'transparent',
    },
    subjectChipIcon: { width: 22, height: 22 },
    subjectChipLabel: { fontSize: 13, fontWeight: '700', color: t.textSub },
    subjectChipLabelActive: { color: '#fff' },
    subjectChipCustom: {
      borderColor: '#475569',
    },
    subjectChipCustomActive: {
      backgroundColor: '#475569',
      borderColor: '#475569',
    },
    subjectSkipHint: {
      fontSize: 11, color: t.textMuted, fontStyle: 'italic',
      marginBottom: 14, marginTop: 2,
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
    regenBtn:       { backgroundColor: 'rgba(96,165,250,0.15)', borderRadius: 8, padding: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
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
    optionHint: { fontSize: 11, color: t.textMuted, marginTop: 4 },

    // Question type badge
    qTypeBadge: {
      borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)',
      borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
      backgroundColor: 'rgba(96,165,250,0.1)',
    },
    qTypeBadgeText: { fontSize: 10, fontWeight: '700', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Shared field group inside question card
    reviewFieldGroup: { marginTop: 4 },
    reviewFieldLabel: { fontSize: 11, fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5, marginTop: 10 },
    reviewFieldInput: {
      backgroundColor: t.bgInput, borderRadius: 10,
      borderWidth: 1, borderColor: t.border,
      padding: 10, fontSize: 14, color: t.text,
    },

    // True/False edit buttons inside review card
    tfEditBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
      backgroundColor: t.bgInput, borderWidth: 1.5, borderColor: t.border,
    },
    tfEditBtnTrue:  { backgroundColor: '#14532d', borderColor: '#22c55e' },
    tfEditBtnFalse: { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
    tfEditBtnText:  { fontSize: 15, fontWeight: '700', color: t.textMuted },

    discardBtn:     { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    discardBtnText: { fontSize: 14, color: t.danger, fontWeight: '600' },

    // Cancel during generation
    cancelGenerateBtn: {
      marginTop: 32,
      paddingVertical: 12, paddingHorizontal: 32,
      borderRadius: 14,
      borderWidth: 1, borderColor: '#334155',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    cancelGenerateBtnText: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },

    // Visual aid processing indicator
    visualProcessingRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 14,
    },
    visualProcessingText: { fontSize: 13, color: '#c084fc', fontWeight: '600' },

    // Visual aid slot cards
    visualSlotCard: {
      borderRadius: 14, borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)',
      backgroundColor: 'rgba(192,132,252,0.05)',
      padding: 14, marginBottom: 12,
    },
    visualSlotCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    visualSlotBadge: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center',
    },
    visualSlotBadgeText:  { fontSize: 11, fontWeight: '800', color: '#fff' },
    visualSlotCardTitle:  { fontSize: 13, fontWeight: '700', color: t.textSub },
    visualSlotFilled:     { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    visualSlotThumb:      { width: 80, height: 80, borderRadius: 10 },
    visualSlotInfo:       { flex: 1, gap: 6 },
    visualSlotQLabel:     { fontSize: 12, color: t.textMuted, fontWeight: '600' },
    visualSlotQRow:       { flexDirection: 'row', gap: 8 },
    visualQOption: {
      width: 36, height: 36, borderRadius: 10,
      borderWidth: 1, borderColor: '#334155',
      backgroundColor: 'rgba(255,255,255,0.04)',
      alignItems: 'center', justifyContent: 'center',
    },
    visualQOptionActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
    visualQOptionText:   { fontSize: 15, fontWeight: '700', color: t.textSub },
    visualQOptionTextActive: { color: '#fff' },

    // Passage preview card (shown in review step when AI extracted a passage)
    passagePreviewCard: {
      backgroundColor: 'rgba(96,165,250,0.08)',
      borderRadius: 14, borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
      padding: 14, marginBottom: 20,
    },
    passagePreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    passagePreviewIcon:   { fontSize: 18 },
    passagePreviewTitle:  { fontSize: 14, fontWeight: '800', color: '#60a5fa' },
    passagePreviewNote:   { fontSize: 12, color: t.textMuted, lineHeight: 17, marginBottom: 8 },
    passagePreviewText:   { fontSize: 13, color: t.textSub, lineHeight: 19 },
  });
}
