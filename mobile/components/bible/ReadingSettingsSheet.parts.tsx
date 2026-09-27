/**
 * ReadingSettingsSheet의 서브 컴포넌트 — 미리보기, 칩 행, 스테퍼, 스위치 행.
 * 모두 무상태 렌더 전용이며 상태는 시트(부모)가 소유한다.
 */

import { Pressable, Switch, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { styles } from './ReadingSettingsSheet.styles';

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

export function StepperRow({
  label,
  value,
  atMin,
  atMax,
  onStep,
}: {
  readonly label: string;
  readonly value: string;
  readonly atMin: boolean;
  readonly atMax: boolean;
  readonly onStep: (delta: 1 | -1) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Text style={styles.stepperValue}>{value}</Text>
      <View style={styles.stepperButtons}>
        <Pressable
          style={styles.stepperButton}
          onPress={() => onStep(-1)}
          disabled={atMin}
          accessibilityRole="button"
          accessibilityLabel={`${label} 줄이기`}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Pressable
          style={styles.stepperButton}
          onPress={() => onStep(1)}
          disabled={atMax}
          accessibilityRole="button"
          accessibilityLabel={`${label} 키우기`}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
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
  return (
    <View style={[styles.switchRow, separated && styles.nameToggle]}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
      />
    </View>
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
  // GAE Genesis 2:8,10 explicitly marks Eden with font.area.
  const nameStyle = highlightNames ? styles.biblePlace : undefined;
  const verse1 = (
    <>
      여호와 하나님이 동방의 <Text style={nameStyle}>에덴</Text>에 동산을 창설하시고 그 지으신 사람을 거기 두시니라
    </>
  );
  const verse2 = (
    <>
      강이 <Text style={nameStyle}>에덴</Text>에서 흘러 나와 동산을 적시고 거기서부터 갈라져 네 근원이 되었으니
    </>
  );
  return (
    <View style={styles.previewSection}>
      <Text style={styles.previewLabel}>본문 미리보기</Text>
      <Text style={styles.previewTitle}>창세기 2장 8, 10절</Text>
      <View style={styles.previewContent}>
        {verseJoining ? (
          <Text style={textStyle}>
            {showVerseNumbers && <Text style={styles.verseNumber}>8 </Text>}
            {verse1}{' '}
            {showVerseNumbers && <Text style={styles.verseNumber}>10 </Text>}
            {verse2}
          </Text>
        ) : (
          <>
            <View style={styles.previewVerse}>
              {showVerseNumbers && <Text style={styles.verseNumber}>8</Text>}
              <Text style={[textStyle, styles.previewVerseText]}>{verse1}</Text>
            </View>
            <View style={styles.previewVerse}>
              {showVerseNumbers && <Text style={styles.verseNumber}>10</Text>}
              <Text style={[textStyle, styles.previewVerseText]}>{verse2}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
