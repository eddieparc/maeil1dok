import { StyleSheet } from 'react-native';
import { useNativeColors } from '../ui/tokens';

export function useSettingsStyles() {
const colors = useNativeColors();
const dark = colors.background === '#1a1a1a';
const COLORS = { bg: colors.background, card: colors.surface, text: colors.text,
  secondary: colors.textSecondary, tertiary: colors.textMuted, border: colors.border,
  accent: colors.accent, accentBg: colors.accentSurface };
return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: COLORS.text,
  },
  done: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: COLORS.accent,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  previewSection: {
    paddingVertical: 16,
  },
  previewLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: COLORS.tertiary,
  },
  previewTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 22,
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 20,
  },
  previewContent: {
    gap: 16,
  },
  previewVerse: {
    flexDirection: 'row',
    gap: 10,
  },
  previewVerseText: {
    flex: 1,
    color: COLORS.text,
  },
  verseNumber: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: COLORS.accent,
    width: 18,
    textAlign: 'right',
  },
  previewName: { color: COLORS.accent },
  sectionTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: COLORS.secondary,
    marginTop: 20,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 44,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: { color: COLORS.secondary, fontFamily: 'Pretendard-Regular', fontSize: 12 },
  chipActive: {
    backgroundColor: dark ? COLORS.card : COLORS.accentBg,
    borderColor: COLORS.accent,
    borderWidth: dark ? 1.5 : 1,
  },
  chipText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: COLORS.secondary,
  },
  chipTextActive: {
    color: COLORS.accent,
    fontFamily: 'Pretendard-SemiBold',
  },
  nameToggle: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    marginTop: 16,
    paddingTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    gap: 12,
    paddingVertical: 4,
  },
  switchLabel: {
    flex: 1,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    lineHeight: 22.5,
    color: COLORS.text,
  },
});
}
