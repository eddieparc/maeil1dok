/**
 * ReadingSettingsSheet — 읽기 설정 하단 시트.
 *
 * 웹 ReadingSettingsSheet.vue와 같은 계약: 미리보기, 글꼴, 글자 크기
 * (14-24), 줄 간격(1.4-2.2), 인명·지명 강조, 두께, 정렬, 읽기 스위치 6개.
 * 상태는 부모가 소유한다 — 이 컴포넌트는 settings를 렌더하고 변경을
 * onChange(key, value)로 올릴 뿐이다. WebView 네비게이션은 없다.
 *
 * 슬라이더 대신 −/+ 스테퍼를 쓴다: @react-native-community/slider가
 * 설치돼 있지 않다. 값 범위와 스텝은 웹 슬라이더와 동일하다.
 */

import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  NATIVE_FONT_META,
  NATIVE_FONT_ORDER,
  resolveNativeFontFamily,
  type FontFamily,
  type FontWeight,
  type ReadingSettings,
  type TextAlign,
} from '../../api/readingSettings';
import { styles } from './ReadingSettingsSheet.styles';
import { ChipRow, PreviewSection, StepperRow, SwitchRow } from './ReadingSettingsSheet.parts';

const FONT_SIZE_STEP = 1;
const LINE_HEIGHT_STEP = 0.1;
/** 웹 시트 슬라이더 범위(스토어 상한 2.4보다 좁다). */
const SHEET_LINE_HEIGHT_MIN = 1.4;
const SHEET_LINE_HEIGHT_MAX = 2.2;
const SHEET_FONT_SIZE_MIN = 14;
const SHEET_FONT_SIZE_MAX = 24;

const FONT_OPTIONS = NATIVE_FONT_ORDER.map((family: FontFamily) => ({
  value: family,
  label: NATIVE_FONT_META[family].label,
}));

const FONT_WEIGHT_OPTIONS: ReadonlyArray<{ value: FontWeight; label: string }> = [
  { value: 'normal', label: '보통' },
  { value: 'medium', label: '중간' },
  { value: 'bold', label: '굵게' },
];

const TEXT_ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: 'left', label: '왼쪽' },
  { value: 'justify', label: '양쪽' },
];

const READING_SWITCHES: ReadonlyArray<{ key: keyof ReadingSettings; label: string }> = [
  { key: 'showVerseNumbers', label: '절 번호 표시' },
  { key: 'verseJoining', label: '절 붙임 (통독 모드)' },
  { key: 'tongdokAutoComplete', label: '통독모드 자동 완료' },
  { key: 'showDescription', label: '시편 머리말 (새한글)' },
  { key: 'showCrossRef', label: '교차 참조 (새한글)' },
  { key: 'showFootnotes', label: '각주 (새한글)' },
];

interface ReadingSettingsSheetProps {
  readonly visible: boolean;
  readonly settings: ReadingSettings;
  readonly onChange: <K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) => void;
  readonly onClose: () => void;
  readonly syncError?: Error | null;
  readonly onRetry?: () => Promise<void>;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export default function ReadingSettingsSheet({
  visible,
  settings,
  onChange,
  onClose,
  syncError,
  onRetry,
}: ReadingSettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const previewFont = resolveNativeFontFamily(settings.fontFamily, settings.fontWeight);
  const previewStyle: TextStyle = {
    fontSize: settings.fontSize,
    lineHeight: Math.round(settings.fontSize * settings.lineHeight),
    textAlign: settings.textAlign,
    ...(previewFont ? { fontFamily: previewFont } : {}),
    fontWeight: previewFont ? undefined : settings.fontWeight === 'bold' ? 600 : settings.fontWeight === 'medium' ? 500 : 400,
  };

  const stepFontSize = (delta: 1 | -1) => {
    const next = settings.fontSize + delta * FONT_SIZE_STEP;
    if (next >= SHEET_FONT_SIZE_MIN && next <= SHEET_FONT_SIZE_MAX) {
      onChange('fontSize', next);
    }
  };
  const stepLineHeight = (delta: 1 | -1) => {
    const next = round1(settings.lineHeight + delta * LINE_HEIGHT_STEP);
    if (next >= SHEET_LINE_HEIGHT_MIN && next <= SHEET_LINE_HEIGHT_MAX) {
      onChange('lineHeight', next);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="읽기 설정 닫기"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>읽기 설정</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="완료"
            >
              <Text style={styles.done}>완료</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {syncError && (
              <View testID="reading-settings-error" accessibilityRole="alert">
                <Text>읽기 설정을 동기화하지 못했습니다.</Text>
                <Pressable
                  testID="reading-settings-retry"
                  accessibilityRole="button"
                  onPress={onRetry}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text>다시 시도</Text>
                </Pressable>
              </View>
            )}
            <PreviewSection
              verseJoining={settings.verseJoining}
              showVerseNumbers={settings.showVerseNumbers}
              highlightNames={settings.highlightNames}
              textStyle={previewStyle}
            />

            <Text style={styles.sectionTitle}>글꼴</Text>
            <ChipRow
              options={FONT_OPTIONS}
              selected={settings.fontFamily}
              onSelect={(value) => onChange('fontFamily', value)}
              groupLabel="글꼴"
              fontFor={(family) => resolveNativeFontFamily(family, 'normal')}
            />

            <StepperRow
              label="글자 크기"
              value={`${settings.fontSize}px`}
              atMin={settings.fontSize <= SHEET_FONT_SIZE_MIN}
              atMax={settings.fontSize >= SHEET_FONT_SIZE_MAX}
              onStep={stepFontSize}
            />
            <StepperRow
              label="줄 간격"
              value={settings.lineHeight.toFixed(1)}
              atMin={settings.lineHeight <= SHEET_LINE_HEIGHT_MIN}
              atMax={settings.lineHeight >= SHEET_LINE_HEIGHT_MAX}
              onStep={stepLineHeight}
            />

            <SwitchRow label="인명·지명 강조" value={settings.highlightNames}
              onChange={(value) => onChange('highlightNames', value)} />
            <Text>인명·지명 강조는 원문에 표시가 있는 역본에 적용됩니다.</Text>

            <Text style={styles.sectionTitle}>두께</Text>
            <ChipRow
              options={FONT_WEIGHT_OPTIONS}
              selected={settings.fontWeight}
              onSelect={(value) => onChange('fontWeight', value)}
              groupLabel="두께"
            />

            <Text style={styles.sectionTitle}>정렬</Text>
            <ChipRow
              options={TEXT_ALIGN_OPTIONS}
              selected={settings.textAlign}
              onSelect={(value) => onChange('textAlign', value)}
              groupLabel="정렬"
            />

            {READING_SWITCHES.map((option) => (
              <SwitchRow
                key={option.key}
                label={option.label}
                value={settings[option.key] === true}
                onChange={(value) => onChange(option.key, value)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
