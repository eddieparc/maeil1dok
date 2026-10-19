import { Text, View, useColorScheme } from 'react-native';
import type { TextStyle } from 'react-native';
import type { BibleBlock } from '../../api/bibleContent';
import { resolveNativeFontFamily, type ReadingSettings } from '../../api/readingSettings';

interface Props {
  readonly blocks: readonly BibleBlock[];
  readonly settings: ReadingSettings;
}

/** The scroll container and completion callbacks stay owned by BibleScreen. */
export default function ReaderBody({ blocks, settings }: Props) {
  const scheme = useColorScheme();
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && scheme === 'dark');
  const color = dark ? '#e5e5e5' : '#1F1A17';
  const secondary = dark ? '#b8b0a9' : '#6B625B';
  const font = resolveNativeFontFamily(settings.fontFamily, settings.fontWeight);
  const typography: TextStyle = {
    fontFamily: font ?? undefined,
    fontWeight: font ? undefined : settings.fontWeight === 'bold' ? 600 : settings.fontWeight === 'medium' ? 500 : 400,
    fontSize: settings.fontSize,
    lineHeight: settings.fontSize * settings.lineHeight,
    textAlign: settings.textAlign,
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
    <View testID="reader-body" style={{ backgroundColor: dark ? '#1a1a1a' : '#FAF8F5',
      flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
      {groups.map((group, index) => {
        const first = group[0];
        switch (first.type) {
          case 'heading':
            return <Text key={index} testID="reader-heading"
              style={[typography, { color: dark ? '#8ba888' : '#5a6e54', marginTop: 20, marginBottom: 12 }]}>
              {first.text}{annotations(first)}
            </Text>;
          case 'note':
            return <Text key={index} testID={`reader-${first.kind ?? 'note'}`}
              style={[typography, { color: secondary, marginBottom: 12 }]}>
              {first.text}{annotations(first)}
            </Text>;
          case 'verse':
            return <Text key={index} testID="reader-verse-paragraph"
              style={[{ marginBottom: 12 }, typography]}>
              {group.flatMap((block, verseIndex) => {
                if (block.type !== 'verse') return [];
                const body = block.inline
                  ? block.inline.map((part, partIndex) => part.kind
                    ? <Text key={`inline-${block.num}-${partIndex}`} testID={`reader-${part.kind}`}
                        style={settings.highlightNames ? {
                          color: part.kind === 'name' ? (dark ? '#c8a882' : '#7c5a3c') : (dark ? '#a0b898' : '#5a6e54'),
                          textDecorationLine: 'underline', textDecorationStyle: 'dotted',
                        } : undefined}>{part.text}</Text>
                    : part.text)
                  : settings.verseJoining ? block.text.replace(/\n/g, ' ') : block.text;
                return [
                  verseIndex > 0 ? ' ' : null,
                  settings.showVerseNumbers && <Text key={`num-${block.num}`} testID="reader-verse-number"
                    style={{ color: dark ? '#9baff0' : '#3B5BA9', fontSize: settings.fontSize * 0.75 }}>
                    {block.num}{' '}
                  </Text>,
                  body, annotations(block),
                ];
              })}
            </Text>;
        }
      })}
    </View>
  );
}
