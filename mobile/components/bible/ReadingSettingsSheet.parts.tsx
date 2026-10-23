/**
 * ReadingSettingsSheet의 서브 컴포넌트 — 미리보기, 칩 행, 스위치 행.
 * 모두 무상태 렌더 전용이며 상태는 시트(부모)가 소유한다.
 */

import { Pressable, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useNativeColors } from '../ui/tokens';
import { useSettingsStyles } from './ReadingSettingsSheet.styles';

export interface ChipOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export function ChipRow<T extends string>({
  options,
  selected,
  onSelect,
  groupLabel,
  fontFor,
}: {
  readonly options: ReadonlyArray<ChipOption<T>>;
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly groupLabel: string;
  readonly fontFor?: (value: T) => string | null;
}) {
  const styles = useSettingsStyles();
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = selected === option.value;
        const chipFont = fontFor?.(option.value) ?? null;
        return (
          <Pressable
            key={option.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${groupLabel} ${option.label}`}
          >
            <Text
              style={[
                styles.chipText,
                active && styles.chipTextActive,
                chipFont ? { fontFamily: chipFont } : null,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
  separated,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly separated?: boolean;
}) {
  const styles = useSettingsStyles();
  const colors = useNativeColors();
  return (
    <Pressable style={[styles.switchRow, separated && styles.nameToggle]}
      accessibilityRole="switch" accessibilityLabel={label}
      accessibilityState={{ checked: value }} onPress={() => onChange(!value)}>
      <Text style={styles.switchLabel}>{label}</Text>
      <View style={{ width: 40, height: 24, padding: 3, borderRadius: 12,
        backgroundColor: value ? colors.accent : colors.border }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.surface,
          transform: [{ translateX: value ? 16 : 0 }] }} />
      </View>
    </Pressable>
  );
}

export function PreviewSection({
  verseJoining,
  showVerseNumbers,
  highlightNames,
  textStyle,
}: {
  readonly verseJoining: boolean;
  readonly showVerseNumbers: boolean;
  readonly highlightNames: boolean;
  readonly textStyle: StyleProp<TextStyle>;
}) {
  const styles = useSettingsStyles();
  const nameStyle = highlightNames ? styles.previewName : undefined;
  const verse1 = (
    <>
      태초에 <Text testID="reading-preview-name" style={nameStyle}>하나님</Text>이 천지를 창조하시니라
    </>
  );
  const verse2 = (
    <>
      땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 <Text testID="reading-preview-name" style={nameStyle}>하나님</Text>의 영은 수면 위에 운행하시니라
    </>
  );
  return (
    <View style={styles.previewSection}>
      <Text style={styles.previewLabel}>본문 미리보기</Text>
      <Text style={styles.previewTitle}>창세기 1장</Text>
      <View style={styles.previewContent}>
        {verseJoining ? (
          <Text style={textStyle}>
            {showVerseNumbers && <Text style={styles.verseNumber}>1 </Text>}
            {verse1}{' '}
            {showVerseNumbers && <Text style={styles.verseNumber}>2 </Text>}
            {verse2}
          </Text>
        ) : (
          <>
            <View style={styles.previewVerse}>
              {showVerseNumbers && <Text style={styles.verseNumber}>1</Text>}
              <Text style={[textStyle, styles.previewVerseText]}>{verse1}</Text>
            </View>
            <View style={styles.previewVerse}>
              {showVerseNumbers && <Text style={styles.verseNumber}>2</Text>}
              <Text style={[textStyle, styles.previewVerseText]}>{verse2}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
