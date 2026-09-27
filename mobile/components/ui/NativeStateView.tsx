import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NativeButton } from './NativeButton';
import { spacing, typography, useNativeColors, type NativeThemeMode } from './tokens';

export interface NativeStateViewProps {
  readonly kind: 'loading' | 'empty' | 'error';
  readonly message: string;
  readonly onRetry?: () => void;
  readonly mode?: NativeThemeMode;
}

export function NativeStateView({ kind, message, onRetry, mode }: NativeStateViewProps) {
  const palette = useNativeColors(mode);
  return (
    <View
      accessibilityState={{ busy: kind === 'loading' }}
      accessibilityLiveRegion="polite"
      style={styles.container}
    >
      {kind === 'loading' && <ActivityIndicator color={palette.accent} accessible={false} />}
      <Text
        accessibilityRole={kind === 'error' ? 'alert' : 'text'}
        style={[typography.body, styles.message, { color: kind === 'error' ? palette.error : palette.textSecondary }]}
      >
        {message}
      </Text>
      {kind === 'error' && onRetry && <NativeButton label="다시 시도" onPress={onRetry} mode={mode} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: spacing.xl, gap: spacing.lg },
  message: { textAlign: 'center' },
});
