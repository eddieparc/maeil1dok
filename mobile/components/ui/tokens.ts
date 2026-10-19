import { useColorScheme } from 'react-native';

export type NativeThemeMode = 'light' | 'dark';

// Semantic counterparts of frontend/app/assets/css/themes.css.
export const colors = {
  light: {
    background: '#FAF8F5',
    surface: '#FFFFFF',
    surfaceMuted: '#F1EFED',
    surfacePressed: '#E9E4DE',
    text: '#1F1A17',
    textSecondary: '#6B625B',
    textMuted: '#9B928A',
    border: '#E9E4DE',
    accent: '#2A1111',
    accentSurface: '#F3EEEE',
    accentPressed: '#E6DCDC',
    onAccent: '#FFFFFF',
    error: '#B3261E',
    scrim: 'rgba(0, 0, 0, 0.45)',
  },
  dark: {
    background: '#1a1a1a',
    surface: '#242424',
    surfaceMuted: '#2d2d2d',
    surfacePressed: '#3D3D3D',
    text: '#f3f4f6',
    textSecondary: '#d1d5db',
    textMuted: '#9ca3af',
    border: '#3d3d3d',
    accent: '#F3EEEE',
    accentSurface: '#3A2A2A',
    accentPressed: '#4A3636',
    onAccent: '#1F1A17',
    error: '#F28B82',
    scrim: 'rgba(0, 0, 0, 0.65)',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const typography = {
  title: { fontFamily: 'Pretendard-SemiBold', fontSize: 20, fontWeight: '600', lineHeight: 28 },
  body: { fontFamily: 'Pretendard-Regular', fontSize: 16, fontWeight: '400', lineHeight: 24 },
  label: { fontFamily: 'Pretendard-SemiBold', fontSize: 16, fontWeight: '600', lineHeight: 24 },
  caption: { fontFamily: 'Pretendard-Regular', fontSize: 14, fontWeight: '400', lineHeight: 20 },
} as const;

export const geometry = { hitTarget: 48, buttonRadius: 12, sheetRadius: 24 } as const;

// App theme is supplied by its owner; omission follows the OS without storing it.
export function useNativeColors(mode?: NativeThemeMode) {
  const system = useColorScheme();
  return colors[mode ?? system ?? 'light'];
}
