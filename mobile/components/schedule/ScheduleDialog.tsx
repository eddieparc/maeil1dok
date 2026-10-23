import { useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNativeColors } from '../ui/tokens';
import { ScheduleIcon } from './ScheduleIcon';

export type ScheduleConfirmation = Readonly<{
  title: string;
  description: string;
  confirmText: string;
  login?: boolean;
  onConfirm: () => void;
}>;

export function ScheduleDialog({ confirmation, onClose }: {
  readonly confirmation: ScheduleConfirmation | null;
  readonly onClose: () => void;
}) {
  const colors = useNativeColors();
  const pendingConfirmation = useRef<(() => void) | null>(null);
  const finishConfirmation = () => {
    const action = pendingConfirmation.current;
    pendingConfirmation.current = null;
    action?.();
  };
  return (
    <Modal visible={confirmation !== null} transparent animationType="fade"
      onRequestClose={onClose} onDismiss={finishConfirmation}>
      {confirmation && <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessible={false} />
        <View style={[styles.dialog, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          {confirmation.login && <View style={[styles.icon, { backgroundColor: colors.accentSurface }]}>
            <ScheduleIcon name="info" size={24} color={colors.accent} />
          </View>}
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{confirmation.title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{confirmation.description}</Text>
          <View style={styles.actions}>
            <TouchableOpacity testID="schedule-dialog-cancel" accessibilityRole="button" onPress={onClose}
              style={[styles.action, { borderWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.actionText, { color: colors.text }]}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="schedule-dialog-confirm" accessibilityRole="button"
              style={[styles.action, { backgroundColor: colors.accent }]}
              onPress={() => {
                if (pendingConfirmation.current) return;
                pendingConfirmation.current = confirmation.onConfirm;
                onClose();
                // iOS must dismiss the child before its action can dismiss
                // the reader's parent pageSheet. Android has no onDismiss.
                if (Platform.OS !== 'ios') finishConfirmation();
              }}>
              <Text style={[styles.actionText, { color: colors.onAccent }]}>{confirmation.confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 16 },
  icon: { width: 48, height: 48, borderRadius: 24, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'Pretendard-SemiBold', fontSize: 18, lineHeight: 27,
    textAlign: 'center', letterSpacing: -0.4, marginBottom: 8 },
  description: { fontFamily: 'Pretendard-Regular', fontSize: 15, lineHeight: 22.5,
    letterSpacing: -0.4, textAlign: 'center', marginBottom: 24 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  actionText: { fontFamily: 'Pretendard-SemiBold', fontSize: 15, lineHeight: 22.5, letterSpacing: -0.4 },
});
