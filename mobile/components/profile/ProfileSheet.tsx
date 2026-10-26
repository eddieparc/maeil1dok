import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileIcon, profileText, useProfileColors } from './ProfilePrimitives';

// Profile's web BaseModal uses a 90%-height bottom sheet on phones, a fixed
// header/footer, and an independently scrolling body.
export function ProfileSheet({ visible, title, onClose, children, footer }: {
  readonly visible: boolean; readonly title: string; readonly onClose: () => void;
  readonly children: ReactNode; readonly footer?: ReactNode;
}) {
  const colors = useProfileColors();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return <Modal visible transparent presentationStyle="overFullScreen" animationType="none"
    supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.frame, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <Pressable accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        testID="profile-sheet-scrim" onPress={onClose}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.scrim }]} />
      <View accessibilityViewIsModal onAccessibilityEscape={onClose}
        style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text accessibilityRole="header" style={[profileText.header, styles.title, { color: colors.text }]}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${title} 닫기`} onPress={onClose} style={styles.close}>
            <ProfileIcon name="close" color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.body}>
          {children}
        </ScrollView>
        {footer != null && <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  sheet: { height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  title: { flex: 1, fontFamily: 'Pretendard-SemiBold', fontSize: 18, lineHeight: 27 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  scroll: { flex: 1 },
  body: { padding: 16 },
  footer: { paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1 },
});
