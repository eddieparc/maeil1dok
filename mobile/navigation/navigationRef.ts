import { createNavigationContainerRef } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Bible: undefined;
  Schedule: undefined;
  More: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  WebView: { url?: string; title?: string } | undefined;
  Login: undefined;
};

/**
 * Lives in its own module so screens can navigate without importing
 * RootNavigator (which imports them back — a cycle).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
