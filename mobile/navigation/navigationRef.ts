import { createNavigationContainerRef } from '@react-navigation/native';

export type TabParamList = {
  Home: { url?: string } | undefined;
  Bible: { url?: string } | undefined;
  Schedule: { url?: string } | undefined;
  Together: { url?: string } | undefined;
  Profile: { url?: string } | undefined;
};

export type RootStackParamList = {
  Main: { screen?: keyof TabParamList; params?: { url?: string } } | undefined;
  WebView: { url?: string } | undefined;
  Login: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
