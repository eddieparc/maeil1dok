import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PlanSubscription } from '../../api/scheduleData';
import { useNativeColors } from '../ui/tokens';
import Svg, { Circle } from 'react-native-svg';
import { ScheduleIcon } from './ScheduleIcon';

export function SchedulePlanSheet({ visible, plans, selectedPlanId, onClose, onSelect, onManage }: {
  readonly visible: boolean;
  readonly plans: readonly PlanSubscription[];
  readonly selectedPlanId: number | null;
  readonly onClose: () => void;
  readonly onSelect: (plan: PlanSubscription) => void;
  readonly onManage: () => void;
}) {
  const colors = useNativeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}
          accessibilityLabel="플랜 선택 닫기" accessibilityRole="button" />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.surface }]}
          accessibilityViewIsModal>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>플랜 선택</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="닫기" style={styles.close} onPress={onClose}>
              <ScheduleIcon name="close" size={22} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {plans.map(plan => {
              const selected = plan.plan_id === selectedPlanId;
              return (
                <TouchableOpacity key={plan.plan_id} testID={`schedule-plan-${plan.plan_id}`}
                  accessibilityRole="radio" accessibilityState={{ selected, checked: selected }}
                  style={[styles.row, { borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.accentSurface : colors.surface }]}
                  onPress={() => onSelect(plan)}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessible={false}
                    stroke={selected ? colors.accent : colors.textMuted} strokeWidth={2}>
                    <Circle cx={12} cy={12} r={10} />
                    {selected && <Circle cx={12} cy={12} r={1} fill={colors.accent} />}
                  </Svg>
                  <Text style={[styles.name, { color: colors.text }]}>{plan.plan_name}</Text>
                  {plan.is_default && <Text style={[styles.badge, { color: colors.accent,
                    backgroundColor: colors.accentSurface }]}>기본</Text>}
                </TouchableOpacity>
              );
            })}
            {plans.length === 0 && <Text style={[styles.empty, { color: colors.textSecondary }]}>
              표시할 활성 플랜이 없어요.
            </Text>}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity accessibilityRole="button" onPress={onClose}
              style={[styles.action, { borderColor: colors.border, backgroundColor: colors.accentSurface }]}>
              <Text style={[styles.actionText, { color: colors.accent }]}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={onManage}
              style={[styles.action, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
              <ScheduleIcon name="settings" size={16} color={colors.onAccent} />
              <Text style={[styles.actionText, { color: colors.onAccent }]}>플랜 관리</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 768, maxHeight: '90%', paddingHorizontal: 24,
    paddingBottom: 32, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  title: { flex: 1, fontFamily: 'Pretendard-Bold', fontSize: 18, lineHeight: 23.4, letterSpacing: -0.4 },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  list: { flexGrow: 0 },
  listContent: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48,
    paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14 },
  name: { flex: 1, fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 21, letterSpacing: -0.4 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999,
    fontFamily: 'Pretendard-Regular', fontSize: 11, lineHeight: 16.5, letterSpacing: -0.4 },
  empty: { fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, letterSpacing: -0.4 },
  footer: { flexDirection: 'row', gap: 8, paddingTop: 20 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, borderWidth: 1, borderRadius: 10, gap: 8 },
  actionText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 21, letterSpacing: -0.4 },
});
