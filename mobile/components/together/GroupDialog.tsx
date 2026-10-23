import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeColors } from '../ui/tokens';
import { GroupIconButton } from './GroupControls';

export function GroupDialog({ visible, title, onClose, children, footer, fullHeight = false }: {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly fullHeight?: boolean;
}) {
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return <Modal visible transparent presentationStyle="overFullScreen" animationType="fade" statusBarTranslucent
    onRequestClose={onClose} supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.frame, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}
      accessibilityViewIsModal onAccessibilityEscape={onClose}>
      <Pressable accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        onPress={onClose} style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.scrim }]} />
      <View style={[styles.panel, fullHeight && styles.fullHeight, { backgroundColor: colors.surface, paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
          <GroupIconButton label={`${title} 닫기`} icon="x" size={24} onPress={onClose} />
        </View>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView>
        {footer && <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  panel: { maxHeight: '90%', flexShrink: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  fullHeight: { height: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title: { flex: 1, fontFamily: 'Pretendard-SemiBold', fontSize: 18, fontWeight: '600', letterSpacing: -0.4 },
  scroll: { flexShrink: 1 },
  body: { padding: 16 },
  footer: { borderTopWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
});
