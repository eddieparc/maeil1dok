import { Pressable, StyleSheet, Text } from 'react-native';
import { geometry, spacing, typography, useNativeColors, type NativeThemeMode } from './tokens';

export interface NativeButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly accessibilityLabel?: string;
  readonly mode?: NativeThemeMode;
}

export function NativeButton({
  label, onPress, disabled = false, selected = false, accessibilityLabel, mode,
}: NativeButtonProps) {
  const palette = useNativeColors(mode);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: selected ? palette.accent : palette.border,
          backgroundColor: pressed && !disabled
            ? (selected ? palette.accentPressed : palette.surfacePressed)
            : (selected ? palette.accentSurface : palette.surface),
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[typography.label, styles.label, { color: selected ? palette.accent : palette.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: geometry.hitTarget,
    minWidth: geometry.hitTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: geometry.buttonRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { textAlign: 'center', flexShrink: 1 },
});
