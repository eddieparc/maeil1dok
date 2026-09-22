import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeButton } from './NativeButton';
import { geometry, spacing, typography, useNativeColors, type NativeThemeMode } from './tokens';

export interface NativeSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly mode?: NativeThemeMode;
}

export function NativeSheet({ visible, title, onClose, children, footer, mode }: NativeSheetProps) {
  const insets = useSafeAreaInsets();
  const palette = useNativeColors(mode);
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        testID="native-sheet-frame"
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={onClose}
        style={[styles.frame, {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }]}
      >
        <Pressable
          testID="native-sheet-scrim"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.scrim }]}
        />
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <Text accessibilityRole="header" style={[typography.title, styles.title, { color: palette.text }]}>
              {title}
            </Text>
            <NativeButton label="닫기" accessibilityLabel={`${title} 닫기`} onPress={onClose} mode={mode} />
          </View>
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
          >
            {children}
            {footer != null && <View style={styles.footer}>{footer}</View>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    flexShrink: 1,
    borderTopLeftRadius: geometry.sheetRadius,
    borderTopRightRadius: geometry.sheetRadius,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  title: { flex: 1 },
  scroll: { flexShrink: 1 },
  content: { padding: spacing.lg },
  footer: { marginTop: spacing.lg },
});
