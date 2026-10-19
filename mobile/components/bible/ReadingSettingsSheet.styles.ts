import { StyleSheet } from 'react-native';

export const COLORS = {
  bg: '#FAF8F5',
  card: '#FFFFFF',
  text: '#1F1A17',
  secondary: '#6B625B',
  tertiary: '#9B928A',
  border: '#E9E4DE',
  accent: '#2A1111',
  accentBg: '#F3EEEE',
} as const;

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
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
    paddingHorizontal: 20,
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
  biblePlace: {
    color: '#5a6e54',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
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
  },
  chip: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.accentBg,
    borderColor: COLORS.accent,
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
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  stepperLabel: {
    flex: 1,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: COLORS.secondary,
  },
  stepperValue: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: COLORS.accent,
    minWidth: 40,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 18,
    color: COLORS.text,
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
    minHeight: 44,
    paddingVertical: 4,
  },
  switchLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: COLORS.text,
  },
});
