// Dark-theme markdown styles used in QuizScreen question cards.
export const mdStyles = {
  body:       { color: '#f1f5f9', fontSize: 20, fontWeight: '700', lineHeight: 30 },
  strong:     { color: '#60a5fa', fontWeight: '800' },
  em:         { color: '#94a3b8', fontStyle: 'italic' },
  code_inline:{ color: '#4ade80', backgroundColor: '#0f2a1a', borderRadius: 4, paddingHorizontal: 4 },
  fence:      { color: '#4ade80', backgroundColor: '#0f2a1a', borderRadius: 8, padding: 12 },
  table:      { borderWidth: 1, borderColor: '#334155', borderRadius: 8, marginBottom: 8 },
  th:         { backgroundColor: '#1e3a5f', padding: 8, color: '#60a5fa', fontWeight: '700' },
  td:         { padding: 8, color: '#e2e8f0', borderTopWidth: 1, borderColor: '#334155' },
  bullet_list:{ marginBottom: 4 },
  list_item:  { color: '#e2e8f0', fontSize: 16 },
};

// Larger font for visual/emoji-heavy questions
export const mdStylesVisual = {
  ...mdStyles,
  body: { ...mdStyles.body, fontSize: 22, lineHeight: 36 },
};
