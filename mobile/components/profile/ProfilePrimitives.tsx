import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNativeColors } from '../ui/tokens';

// Profile-local counterparts of the web profile CSS. Theme ownership remains
// with useNativeColors; card/hover differ from the shared secondary surface.
export function useProfileColors() {
  const colors = useNativeColors();
  const dark = colors.background === '#1a1a1a';
  return {
    ...colors, dark,
    card: dark ? '#2a2a2a' : colors.surface,
    hover: dark ? '#333333' : '#EFECE8',
    divider: dark ? '#333333' : '#F5F2EE',
    future: dark ? colors.surface : colors.background,
    futureText: dark ? '#6B7280' : colors.textMuted,
  };
}

export const profileText = StyleSheet.create({
  title: { fontFamily: 'Pretendard-Bold', fontSize: 20, lineHeight: 26, letterSpacing: -0.6 },
  header: { fontFamily: 'Pretendard-Bold', fontSize: 16, lineHeight: 24, letterSpacing: -0.4 },
  heading: { fontFamily: 'Pretendard-Bold', fontSize: 15, lineHeight: 22.5, letterSpacing: -0.4 },
  body: { fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 19.5, letterSpacing: -0.4 },
  label: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 21, letterSpacing: -0.4 },
  caption: { fontFamily: 'Pretendard-Regular', fontSize: 11, lineHeight: 16.5, letterSpacing: -0.4 },
  small: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, lineHeight: 18, letterSpacing: -0.4 },
  bold: { fontFamily: 'Pretendard-Bold' },
});

const iconPaths = {
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  mutual: 'M2 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2 M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 11l2 2 4-4',
  left: 'm15 18-6-6 6-6',
  right: 'm9 18 6-6-6-6',
  down: 'm6 9 6 6 6-6',
  up: 'm18 15-6-6-6 6',
  close: 'M18 6 6 18 M6 6l12 12',
  check: 'm20 6-11 11-5-5',
  settings: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
  book: 'M12 7v14 M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z',
  flame: 'M12 22c4.4 0 7-3 7-7 0-3-1.5-5-3-6 .5 3-1 4-2 4 0-4-2-7-5-11 0 5-1 7-3 10-3 4-1 10 6 10Z',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M9 16l2 2 4-4',
  star: 'm12 3 2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.34l-5.62 2.96 1.07-6.27L2.9 9.6l6.3-.9L12 3Z',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v8a5 5 0 0 1-10 0V4Z M7 6H3v3a4 4 0 0 0 4 4 M17 6h4v3a4 4 0 0 1-4 4',
  award: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M8 11l-1 11 5-3 5 3-1-11',
  lock: 'M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2 M8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff: 'm3 3 18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.7 M6.3 6.3A18 18 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.7-1.3',
} as const;

export function ProfileIcon({ name, size = 20, color }: {
  readonly name: keyof typeof iconPaths; readonly size?: number; readonly color: string;
}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    <Path d={iconPaths[name]} />
    {name === 'user' && <Circle cx={12} cy={7} r={4} />}
    {name === 'settings' && <Circle cx={12} cy={12} r={3} />}
  </Svg>;
}

export function ProfileAvatar({ uri, name, failed = false, onError, size = 64 }: {
  readonly uri: string | null; readonly name: string; readonly failed?: boolean;
  readonly onError?: () => void; readonly size?: number;
}) {
  const colors = useProfileColors();
  const frame = { width: size, height: size, borderRadius: size / 2 };
  return <View accessible accessibilityLabel={uri && !failed ? `${name} 프로필 이미지` : '기본 프로필 이미지'}
    style={[frame, styles.avatar, { backgroundColor: colors.accent }]}>
      <ProfileIcon name="user" size={size * 0.5625} color={colors.onAccent} />
      {uri && !failed && <Image source={{ uri }} onError={onError} accessible={false}
        style={[frame, StyleSheet.absoluteFillObject]} />}
    </View>;
}

export function ProfileButton({ label, onPress, disabled = false, primary = false, small = false, testID, style }: {
  readonly label: string; readonly onPress: () => void; readonly disabled?: boolean;
  readonly primary?: boolean; readonly small?: boolean; readonly testID?: string; readonly style?: StyleProp<ViewStyle>;
}) {
  const colors = useProfileColors();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, small && styles.smallButton, {
      borderWidth: colors.dark && !primary ? 1.5 : 1,
      borderColor: primary || colors.dark ? colors.accent : colors.border,
      backgroundColor: primary ? pressed ? colors.accentPressed : colors.accent : pressed ? colors.hover : colors.dark ? 'transparent' : colors.accentSurface,
      opacity: disabled ? 0.5 : 1,
    }, style]}>
    <Text style={[profileText.label, small && { fontSize: 13 }, { color: primary ? colors.onAccent : colors.accent }]}>{label}</Text>
  </Pressable>;
}

export function ProfileRing({ children, value }: { readonly children: ReactNode; readonly value: number }) {
  const colors = useProfileColors();
  const circumference = 2 * Math.PI * 44;
  return <View testID="profile-completion-rate" accessible accessibilityLabel={`완료율 ${value}%`}
    accessibilityValue={{ min: 0, max: 100, now: value }}
    style={styles.ring}>
    <Svg width={96} height={96} viewBox="0 0 96 96" accessible={false}>
      <Circle cx={48} cy={48} r={44} fill="none" stroke={colors.hover} strokeWidth={8} />
      <Circle cx={48} cy={48} r={44} fill="none" stroke={colors.accent} strokeWidth={8}
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)}
        strokeLinecap="round" rotation={-90} origin="48, 48" />
    </Svg>
    <View style={styles.ringCenter}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  button: { minHeight: 48, minWidth: 44, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallButton: { minHeight: 44, paddingHorizontal: 16 },
  ring: { width: 96, height: 96, flexShrink: 0 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
