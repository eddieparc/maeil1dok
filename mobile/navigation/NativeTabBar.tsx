import { Platform, StyleSheet } from 'react-native';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NativeTabBarItem = {
  readonly label: string;
  readonly symbol: string;
  readonly selectedSymbol: string;
};

type NativeTabBarProps = ViewProps & {
  readonly items: readonly NativeTabBarItem[];
  readonly selectedIndex: number;
  readonly bottomInset: number;
  readonly onTabSelect: (event: NativeSyntheticEvent<{ index: number }>) => void;
};

const NativeTabBarView = Platform.OS === 'ios'
  ? requireNativeViewManager<NativeTabBarProps>('NativeTabBar', 'NativeTabBarView')
  : null;

const items: Record<string, NativeTabBarItem> = {
  Home: { label: '홈', symbol: 'house', selectedSymbol: 'house.fill' },
  Bible: { label: '성경', symbol: 'book', selectedSymbol: 'book.fill' },
  Schedule: { label: '통독표', symbol: 'calendar', selectedSymbol: 'calendar' },
  Together: { label: '함께', symbol: 'person.2', selectedSymbol: 'person.2.fill' },
  Profile: { label: '내 정보', symbol: 'person.circle', selectedSymbol: 'person.circle.fill' },
};

export const shouldUseNativeTabBar = (
  platform: string,
  nativeViewAvailable: boolean,
) => platform === 'ios' && nativeViewAvailable;

export const hasNativeTabBar = shouldUseNativeTabBar(
  Platform.OS,
  NativeTabBarView !== null,
);

export function NativeTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  if (!NativeTabBarView) return null;

  return (
    <NativeTabBarView
      style={[styles.bar, { height: 55 + insets.bottom }]}
      items={state.routes.map((route) => items[route.name])}
      selectedIndex={state.index}
      bottomInset={insets.bottom}
      onTabSelect={({ nativeEvent }) => {
        const route = state.routes[nativeEvent.index];
        if (!route || state.index === nativeEvent.index) return;
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!event.defaultPrevented) navigation.navigate(route.name);
      }}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'transparent',
  },
});
