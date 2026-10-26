import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeColors } from '../components/ui/tokens';
import type { TabParamList } from './navigationRef';
import { NativeSidebar } from './NativeSidebar';

/*
 * Lucide 1.20 outlines, ISC License.
 * Copyright (c) Lucide Contributors.
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
const items: Record<keyof TabParamList, { readonly label: string; readonly path: string }> = {
  Home: {
    label: '홈',
    path: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8 M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  },
  Bible: {
    label: '성경',
    path: 'M12 7v14 M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  },
  Schedule: { label: '통독표', path: 'M8 2v4 M16 2v4 M3 10h18' },
  Together: {
    label: '함께',
    path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3.128a4 4 0 0 1 0 7.744 M22 21v-2a4 4 0 0 0-3-3.87',
  },
  Profile: { label: '내 정보', path: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' },
};

// The strip is in the navigator's flow, so scroll views need no overlay reserve.
export function useNativeTabBarInset(): number {
  return 0;
}

function NativeTabStrip({
  state, onTabSelect,
}: {
  readonly state: BottomTabBarProps['state'];
  readonly onTabSelect: (index: number) => void;
}) {
  const palette = useNativeColors();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index];
  const contentHeight = current.name === 'Bible' && current.params
    && 'readerActive' in current.params && current.params.readerActive === true ? 56 : 60;
  return (
    <SafeAreaView edges={['bottom']} style={styles.outer}>
      <View style={[
        styles.surface,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: contentHeight + Math.max(24, insets.bottom),
          paddingBottom: Math.max(24, insets.bottom),
        },
      ]}>
        <View style={[styles.tabs, { height: contentHeight }]}>
          {state.routes.map((route, index) => {
            const name = route.name as keyof TabParamList;
            const selected = state.index === index;
            const color = selected ? palette.accent : palette.textMuted;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={items[name].label}
                accessibilityState={{ selected }}
                onPress={() => onTabSelect(index)}
                style={({ pressed }) => [styles.tab, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24"
                  fill="none" stroke={color} strokeWidth={selected ? 2.2 : 2}
                  strokeLinecap="round" strokeLinejoin="round" accessible={false}>
                  <Path d={items[name].path} />
                  {name === 'Schedule' && <Rect width={18} height={18} x={3} y={4} rx={2} />}
                  {name === 'Together' && <Circle cx={9} cy={7} r={4} />}
                  {name === 'Profile' && <Circle cx={12} cy={7} r={4} />}
                </Svg>
                <Text style={[styles.label, {
                  color,
                  fontFamily: selected ? 'Pretendard-SemiBold' : 'Pretendard-Medium',
                }]}>{items[name].label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

export function NativeTabBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const onTabSelect = (index: number) => {
      const route = state.routes[index];
      if (!route) return;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (state.index !== index && !event.defaultPrevented) navigation.navigate(route.name);
  };
  return width >= 1024
    ? <NativeSidebar state={state} items={items} onTabSelect={onTabSelect} />
    : <NativeTabStrip state={state} onTabSelect={onTabSelect} />;
}

const styles = StyleSheet.create({
  outer: { backgroundColor: '#FAF8F5' },
  surface: { borderTopWidth: 1 },
  tabs: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingHorizontal: 8,
    maxWidth: 768,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 44,
    minHeight: 44,
  },
  label: { fontSize: 11, lineHeight: 11, letterSpacing: -0.4, includeFontPadding: false },
});
