import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors as palettes, useNativeColors } from '../ui/tokens';

// Local counterparts of FilterChip, AppButton and the groups page icon buttons.
// Shared shell primitives are owned by the parent parity work.
export function GroupButton({ label, onPress, variant = 'secondary', size = 'md', selected = false, disabled = false, loading = false, count }: {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'chip';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly count?: number;
}) {
  const colors = useNativeColors();
  const dark = colors.text === palettes.dark.text;
  const filled = variant === 'primary' || (variant === 'chip' && selected && !dark);
  const outlined = dark && (variant === 'secondary' || (variant === 'chip' && selected));
  const unavailable = disabled || loading;
  const color = filled ? colors.onAccent : variant === 'danger' ? colors.error
    : variant === 'chip' && !selected ? colors.textSecondary : colors.accent;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: unavailable, selected, busy: loading }}
    disabled={unavailable} onPress={unavailable ? undefined : onPress}
    style={({ pressed }) => [styles.button, variant === 'chip' ? styles.chip : styles[size], {
      backgroundColor: filled ? colors.accent : pressed ? colors.surfacePressed
        : variant === 'secondary' && !dark ? colors.accentSurface : variant === 'chip' ? colors.surface : 'transparent',
      borderColor: variant === 'danger' ? colors.error : filled || outlined ? colors.accent : colors.border,
      borderWidth: outlined ? 1.5 : 1, opacity: unavailable ? 0.5 : pressed ? 0.85 : 1,
    }]}>
    {loading && <ActivityIndicator size="small" color={color} />}
    <Text style={[styles.buttonText, { color, fontSize: variant === 'chip' || size === 'sm' ? 13 : size === 'lg' ? 15 : 14 }]}>
      {label}{count !== undefined ? ` ${count}` : ''}
    </Text>
  </Pressable>;
}

export function GroupIconButton({ label, icon, onPress, primary = false, size = 20 }: {
  readonly label: string;
  readonly icon: ComponentProps<typeof Feather>['name'];
  readonly onPress: () => void;
  readonly primary?: boolean;
  readonly size?: number;
}) {
  const colors = useNativeColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.iconButton, {
      backgroundColor: primary ? colors.accent : pressed ? colors.surfacePressed : 'transparent',
      opacity: pressed ? 0.85 : 1,
    }]}>
    <Feather name={icon} size={size} color={primary ? colors.onAccent : colors.text} accessible={false} />
  </Pressable>;
}

export function GroupBadges({ isPublic, membership }: { readonly isPublic: boolean; readonly membership?: string }) {
  const colors = useNativeColors();
  const dark = colors.text === palettes.dark.text;
  return <View style={styles.badges}>
    <Text style={[styles.badge, { backgroundColor: colors.surfaceMuted, color: colors.textSecondary }]}>{isPublic ? '공개' : '비공개'}</Text>
    {membership && <Text style={[styles.badge, {
      backgroundColor: dark ? 'transparent' : colors.accentSurface, color: colors.accent,
      ...(dark ? { borderWidth: 1.5, borderColor: colors.accent } : {}),
    }]}>{membership}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  button: { minWidth: 44, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  sm: { minHeight: 44, paddingHorizontal: 12 },
  md: { minHeight: 48, paddingHorizontal: 20 },
  lg: { minHeight: 52, paddingHorizontal: 20 },
  chip: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, gap: 4 },
  buttonText: { fontFamily: 'Pretendard-SemiBold', fontWeight: '600', letterSpacing: -0.4, textAlign: 'center', flexShrink: 1 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, fontWeight: '600', lineHeight: 11, letterSpacing: -0.4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
});
