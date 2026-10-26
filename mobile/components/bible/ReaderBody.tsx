import { Platform, Text, View, useWindowDimensions } from 'react-native';
import type { TextStyle } from 'react-native';
import type { BibleBlock } from '../../api/bibleContent';
import { resolveNativeFontFamily, type ReadingSettings } from '../../api/readingSettings';
import { useNativeColors, useNativeTheme } from '../ui/tokens';

interface Props {
  readonly blocks: readonly BibleBlock[];
  readonly settings: ReadingSettings;
  readonly onVersePress?: (verse: number) => void;
}

/** The scroll container and completion callbacks stay owned by BibleScreen. */
export default function ReaderBody({ blocks, settings, onVersePress }: Props) {
  const colors = useNativeColors();
  const { width } = useWindowDimensions();
  const dark = useNativeTheme() === 'dark';
  const color = dark ? '#e5e5e5' : colors.text;
  const secondary = colors.textSecondary;
  const font = resolveNativeFontFamily(settings.fontFamily, settings.fontWeight);
  const typography: TextStyle = {
    fontFamily: font ?? undefined,
    fontWeight: font ? undefined : settings.fontWeight === 'bold' ? 600 : settings.fontWeight === 'medium' ? 500 : 400,
    fontSize: settings.fontSize,
    lineHeight: settings.fontSize * settings.lineHeight,
    textAlign: settings.textAlign,
    // Android inter-word justification resets tracking when painting. Match its
    // measurement to that zero tracking so negative spacing cannot clip glyphs.
    letterSpacing: Platform.OS === 'android' && settings.textAlign === 'justify' ? 0 : -0.02 * settings.fontSize,
    color,
  };
  const visible = blocks.filter(block => block.type !== 'note'
    || (block.kind !== 'description' || settings.showDescription)
      && (block.kind !== 'crossref' || settings.showCrossRef));
  // Each group is one native Text layout, rather than Views made to look inline.
  const groups: BibleBlock[][] = [];
  for (const block of visible) {
    const last = groups.at(-1);
    if (settings.verseJoining && block.type === 'verse' && last?.[0].type === 'verse') last.push(block);
    else groups.push([block]);
  }
  const annotations = (block: BibleBlock) => settings.showFootnotes && block.footnotes?.map((note, index) => (
    <Text key={`footnote-${block.type === 'verse' ? block.num : block.type}-${index}`} testID="reader-footnote" style={{ color: secondary, fontSize: settings.fontSize * 0.85 }}>
      {` [${note}]`}
    </Text>
  ));
  return (
    <View testID="reader-body" style={{ backgroundColor: colors.background,
      flexGrow: 1, paddingHorizontal: width > 768 ? 16 : 5, paddingTop: 16, paddingBottom: 12 }}>
      {groups.map((group, index) => {
        const first = group[0];
        switch (first.type) {
          case 'heading':
            return <Text key={index} testID="reader-heading"
              style={{ fontFamily: 'Pretendard-SemiBold', fontSize: 17.6, lineHeight: 28,
                textAlign: 'center', color: dark ? '#8ba888' : colors.accent,
                marginTop: index === 0 ? 0 : settings.verseJoining ? 26.4 : 32,
                marginBottom: settings.verseJoining ? 8.8 : 4 }}>
              {first.text}{annotations(first)}
            </Text>;
          case 'note':
            return <Text key={index} testID={`reader-${first.kind ?? 'note'}`}
              style={[typography, { color: secondary, fontSize: settings.fontSize * (first.kind === 'description' ? 0.9 : 0.85),
                fontStyle: first.kind === 'description' ? 'italic' : 'normal',
                marginTop: first.kind === 'description' ? 8 : 4,
                paddingLeft: first.kind === 'description' ? 12 : 8, marginBottom: 12 }]}>
              {first.text}{annotations(first)}
            </Text>;
          case 'verse':
            {
              const verses = group.map((block, verseIndex) => {
                if (block.type !== 'verse') return [];
                const body = block.inline
                  ? block.inline.map((part, partIndex) => part.kind
                    ? <Text key={`inline-${block.num}-${partIndex}`} testID={`reader-${part.kind}`}
                        style={settings.highlightNames ? {
                          color: part.kind === 'name' ? (dark ? '#c9a67a' : '#7c5a3c') : (dark ? '#9cb094' : '#5a6e54'),
                          textDecorationLine: 'underline', textDecorationStyle: 'dotted',
                        } : undefined}>{part.text}</Text>
                    : settings.verseJoining ? part.text.replace(/\n/g, ' ') : part.text)
                  : settings.verseJoining ? block.text.replace(/\n/g, ' ') : block.text;
                const number = settings.showVerseNumbers && <Text key={`num-${block.num}`} testID="reader-verse-number"
                  style={{ color: dark ? '#666666' : colors.accent, fontFamily: 'Pretendard-Medium',
                    fontSize: settings.fontSize * (settings.verseJoining ? 0.65 : 0.75),
                    lineHeight: settings.verseJoining ? undefined : settings.fontSize * 1.5,
                    minWidth: settings.verseJoining ? undefined : settings.fontSize * 0.6,
                    marginRight: settings.verseJoining ? 0 : 4.8, textAlign: 'right' }}>
                  {block.num}{settings.verseJoining ? ' ' : ''}
                </Text>;
                return settings.verseJoining
                  ? <Text key={block.num} onPress={onVersePress ? () => onVersePress(block.num) : undefined}>
                      {verseIndex > 0 ? ' ' : ''}{number}{body}{annotations(block)}</Text>
                  : <View key={block.num} testID="reader-verse-row"
                      style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4, paddingHorizontal: 5.6 }}>
                      {number}<Text testID="reader-verse-paragraph" lineBreakStrategyIOS="hangul-word"
                        style={[typography, { flex: 1 }]}
                        onPress={onVersePress ? () => onVersePress(block.num) : undefined}>
                        {body}{annotations(block)}
                      </Text>
                    </View>;
              });
              return settings.verseJoining
                ? <Text key={index} testID="reader-verse-paragraph" lineBreakStrategyIOS="hangul-word"
                    style={typography}>{verses}</Text>
                : <View key={index}>{verses}</View>;
            }
        }
      })}
    </View>
  );
}
