import { StyleSheet } from 'react-native';

// ── Layout constants ──────────────────────────────────────────
export const PROT_R      = 108;
export const PROT_CX     = 140;
export const PROT_CY     = 130;
export const SLIDER_W    = 240;

export const RULER_DISPLAY_W = 280;

export const NL_W      = 280;
export const NL_PAD    = 20;
export const NL_USABLE = NL_W - NL_PAD * 2;

// ── Shared measurement styles ─────────────────────────────────
// Used by ProtractorRenderer, RulerRenderer, and NumberLineRenderer.
export const measStyles = StyleSheet.create({
  // Protractor
  protContainer: {
    width: 280, height: 178,
    alignSelf: 'center', marginBottom: 4, position: 'relative',
  },
  protArc: {
    position: 'absolute',
    width: PROT_R * 2, height: PROT_R,
    borderTopLeftRadius: PROT_R, borderTopRightRadius: PROT_R,
    borderWidth: 1.5, borderBottomWidth: 0, borderColor: '#334155',
  },
  protMarkLabel: { position: 'absolute', fontSize: 10, color: '#475569', width: 26, textAlign: 'center' },
  protRayLabel:  { position: 'absolute', fontSize: 13, color: '#e2e8f0', fontWeight: '800', fontStyle: 'italic' },
  protReadout: {
    position: 'absolute',
    left: PROT_CX - 32, top: PROT_CY - 52,
    width: 64, textAlign: 'center',
    fontSize: 22, fontWeight: '900', color: '#7c3aed',
  },

  // Ruler
  rulerReading: {
    textAlign: 'center', fontSize: 26, fontWeight: '900',
    color: '#7c3aed', marginBottom: 12,
  },
  rulerLiveReadout: {
    textAlign: 'center', fontSize: 13, fontWeight: '600',
    color: '#64748b', marginBottom: 6, marginTop: 2,
  },
  rulerExplanation: {
    fontSize: 13, color: '#94a3b8', textAlign: 'center',
    marginTop: 4, lineHeight: 18,
  },
  rulerContainer: {
    width: RULER_DISPLAY_W, height: 72,
    alignSelf: 'center', marginBottom: 4, position: 'relative',
  },
  rulerBody: {
    position: 'absolute', top: 0, left: 0,
    width: RULER_DISPLAY_W, height: 30,
    backgroundColor: '#1e293b',
    borderRadius: 4, borderWidth: 1, borderColor: '#334155',
  },
  rulerTickLabel: {
    position: 'absolute',
    width: 16, textAlign: 'center',
    fontSize: 10, color: '#94a3b8', fontWeight: '700',
  },
  rulerMarker: {
    position: 'absolute', top: 0, width: 3, height: 44,
    borderRadius: 2,
  },
  rulerMarkerHandle: {
    position: 'absolute', top: 32, width: 24, height: 20,
    borderRadius: 10, backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  rulerSectionLabel: {
    width: 280, fontSize: 11, color: '#64748b', textAlign: 'center',
    marginTop: 6, marginBottom: 2, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },

  // Shared slider
  sliderRow: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'center', gap: 8, marginTop: 8, marginBottom: 4,
  },
  sliderTrack: {
    width: SLIDER_W, height: 6, borderRadius: 3,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    position: 'relative',
  },
  sliderFill:   { height: '100%', borderRadius: 3, backgroundColor: '#7c3aed', position: 'absolute' },
  sliderHandle: {
    position: 'absolute', top: -9, width: 24, height: 24,
    borderRadius: 12, backgroundColor: '#7c3aed',
    borderWidth: 2.5, borderColor: '#a78bfa',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  sliderEndLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', width: 32, textAlign: 'center' },
  sliderHint:     { fontSize: 11, color: '#475569', textAlign: 'center', marginBottom: 6 },
  worksheetHint:  { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 2, marginBottom: 4, fontStyle: 'italic' },

  // v2: scale-choice step
  scaleChoiceBox: {
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 1, borderColor: '#334155',
    padding: 14, marginBottom: 12,
  },
  scaleChoicePrompt: {
    fontSize: 13, color: '#cbd5e1', fontWeight: '700',
    textAlign: 'center', marginBottom: 10,
  },
  scaleChoiceRow:    { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  scaleChoiceBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#334155',
    backgroundColor: '#0f172a', alignItems: 'center',
  },
  scaleChoiceBtnSelected: { borderColor: '#4ade80', backgroundColor: '#14532d' },
  scaleChoiceBtnText:     { fontSize: 13, color: '#e2e8f0', fontWeight: '700' },
  scaleChoiceError: {
    fontSize: 12, color: '#fbbf24', textAlign: 'center',
    marginTop: 8, fontStyle: 'italic',
  },
  scaleConfirmed: {
    backgroundColor: '#14532d', borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12, marginBottom: 8,
  },
  scaleConfirmedText: { fontSize: 12, color: '#86efac', textAlign: 'center', fontWeight: '600' },

  // v1: typed-answer input row
  typedAnswerRow:      { alignSelf: 'center', alignItems: 'center', marginTop: 10, marginBottom: 2 },
  typedAnswerLabel:    { fontSize: 13, color: '#94a3b8', marginBottom: 6, textAlign: 'center' },
  typedAnswerInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#334155',
    paddingHorizontal: 14, paddingVertical: 6, gap: 4,
  },
  typedAnswerInput: { fontSize: 28, fontWeight: '900', color: '#e2e8f0', minWidth: 52, textAlign: 'center' },
  typedAnswerUnit:  { fontSize: 22, fontWeight: '800', color: '#7c3aed' },

  // v3: build mode label
  buildModeLabel: {
    fontSize: 13, color: '#94a3b8', textAlign: 'center',
    marginTop: 4, marginBottom: 4, fontStyle: 'italic',
  },

  // ── Step indicator (align mode 3-step) ───────────────────────
  stepBar: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 14, gap: 10,
  },
  stepBadgeWrap: {
    backgroundColor: '#7c3aed', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  stepBadge: {
    fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.4,
  },
  stepTitle: {
    flex: 1, fontSize: 13, fontWeight: '700', color: '#cbd5e1',
  },

  // ── Estimate mode — 2×2 grid buttons ─────────────────────────
  estimateGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginVertical: 12, justifyContent: 'center',
  },
  estimateBtn: {
    width: '45%', paddingVertical: 18, borderRadius: 14,
    backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155',
    alignItems: 'center',
  },
  estimateBtnChosen: {
    borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)',
  },
  estimateBtnCorrect: { backgroundColor: '#14532d', borderColor: '#22c55e' },
  estimateBtnWrong:   { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  estimateBtnDimmed:  { opacity: 0.4 },
  estimateBtnText: { fontSize: 22, fontWeight: '800', color: '#e2e8f0' },

  // ── Estimate mode — 3-button row (align step 1) ───────────────
  estimateRow: {
    flexDirection: 'row', gap: 10,
    marginVertical: 12, justifyContent: 'center',
  },
  estimatePill: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155',
    alignItems: 'center',
  },
  estimatePillChosen:  { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)' },
  estimatePillText: { fontSize: 18, fontWeight: '800', color: '#e2e8f0' },

  // ── Estimate motivational banner ──────────────────────────────
  estimateBanner: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.28)',
    paddingVertical: 12, paddingHorizontal: 16,
    marginTop: 8, alignItems: 'center',
  },
  estimateBannerText: {
    fontSize: 13, fontWeight: '600', color: '#c4b5fd', textAlign: 'center',
  },

  // ── Align mode action buttons ─────────────────────────────────
  alignActionRow: {
    flexDirection: 'row', gap: 12, marginTop: 16,
  },
  alignClearBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 2, borderColor: '#334155', alignItems: 'center',
  },
  alignClearBtnText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  alignNextBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#7c3aed', alignItems: 'center',
  },
  alignNextBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // ── Spot the Mistake — claim buttons ─────────────────────────
  claimRow: {
    flexDirection: 'row', gap: 10,
    marginTop: 14, marginBottom: 10,
  },
  claimBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8,
    backgroundColor: '#1e293b', borderRadius: 16,
    borderWidth: 2, borderColor: '#334155', gap: 6,
  },
  claimBtnCorrect: { backgroundColor: '#14532d', borderColor: '#22c55e' },
  claimBtnWrong:   { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  claimBtnDimmed:  { opacity: 0.4 },
  claimAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#334155',
  },
  claimName:  { fontSize: 14, fontWeight: '800', color: '#e2e8f0' },
  claimValue: { fontSize: 13, fontWeight: '600', color: '#a78bfa' },

  // ── Spot the Mistake — "neither" button ──────────────────────
  neitherBtn: {
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 2, borderColor: '#334155',
    backgroundColor: '#1e293b', alignItems: 'center', marginBottom: 10,
  },
  neitherBtnCorrect: { backgroundColor: '#14532d', borderColor: '#22c55e' },
  neitherBtnWrong:   { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  neitherBtnText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  spotHint: {
    fontSize: 12, color: '#64748b', textAlign: 'center',
    marginTop: 2, fontStyle: 'italic',
  },
});

// ── Number line styles ─────────────────────────────────────────
export const nlStyles = StyleSheet.create({
  container: {
    width: NL_W, height: 80,
    alignSelf: 'center', marginBottom: 4, position: 'relative',
  },
  line: {
    position: 'absolute', top: 28, left: NL_PAD, right: NL_PAD,
    height: 2, backgroundColor: '#475569', borderRadius: 1,
  },
  tick: {
    position: 'absolute', top: 28,
    width: 1.5, height: 14, backgroundColor: '#64748b',
  },
  tickLabel: {
    position: 'absolute', top: 44,
    width: 32, textAlign: 'center',
    fontSize: 10, color: '#94a3b8', fontWeight: '700',
  },
  point: {
    position: 'absolute', top: 16,
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2.5, borderColor: '#a78bfa',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  sectionNum: {
    position: 'absolute', top: 10,
    width: 16, textAlign: 'center',
    fontSize: 9, color: '#94a3b8', fontWeight: '700',
  },
});
