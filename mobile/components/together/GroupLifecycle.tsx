import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { NativeStateView } from '../ui/NativeStateView';
import { useNativeColors } from '../ui/tokens';
import { GroupButton } from './GroupControls';
import { GroupDialog } from './GroupDialog';
import type { TogetherModel, TogetherState } from './TogetherModel';

function GroupCheckbox({ label, description, checked, disabled, onPress }: {
  readonly label: string;
  readonly description?: string | null;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  const colors = useNativeColors();
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }}
    disabled={disabled} onPress={disabled ? undefined : onPress}
    style={({ pressed }) => [styles.checkboxRow, { opacity: disabled ? 0.5 : 1, backgroundColor: pressed ? colors.surfacePressed : 'transparent' }]}>
    <View style={[styles.checkbox, { borderColor: checked ? colors.accent : colors.border, backgroundColor: checked ? colors.accent : colors.surface }]}>
      {checked && <Feather name="check" size={12} color={colors.onAccent} accessible={false} />}
    </View>
    <View style={styles.checkboxCopy}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {description ? <Text style={[styles.help, { color: colors.textSecondary }]}>{description}</Text> : null}
    </View>
  </Pressable>;
}

export function GroupLifecycle({ model, state }: {
  readonly model: TogetherModel;
  readonly state: TogetherState;
}) {
  const colors = useNativeColors();
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  const labelStyle = [styles.label, { color: colors.text }];
  const draft = state.draft;
  return <>
    <GroupDialog visible={state.createOpen} fullHeight title="새 그룹 만들기" onClose={() => model.closeCreate()}
      footer={<View style={styles.actions}>
        <GroupButton label="취소" disabled={state.creating} onPress={() => model.closeCreate()} />
        <GroupButton label={state.creating ? '생성 중...' : '그룹 만들기'} variant="primary" loading={state.creating}
          disabled={state.plansStatus !== 'ready' || state.plans.length === 0} onPress={() => { void model.create(); }} />
      </View>}>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={labelStyle}>그룹 이름</Text>
          <TextInput accessibilityLabel="그룹 이름" placeholder="그룹 이름을 입력하세요" placeholderTextColor={colors.textMuted}
            value={draft.name} maxLength={100} editable={!state.creating}
            onChangeText={(name) => model.editDraft({ name })} style={inputStyle} />
        </View>
        <View style={styles.field}>
          <Text style={labelStyle}>설명</Text>
          <TextInput accessibilityLabel="그룹 설명" placeholder="그룹 설명을 입력하세요 (선택사항)" placeholderTextColor={colors.textMuted}
            value={draft.description} maxLength={500} multiline editable={!state.creating}
            onChangeText={(description) => model.editDraft({ description })} style={[inputStyle, styles.description]} />
        </View>
        <View style={styles.field}>
          <Text style={labelStyle}>성경 읽기 플랜 (복수 선택 가능)</Text>
          <ScrollView nestedScrollEnabled style={[styles.plans, { borderColor: colors.border, backgroundColor: colors.surface }]}
            contentContainerStyle={styles.planContent}>
            {state.plansStatus === 'loading' && <NativeStateView kind="loading" message="플랜을 불러오는 중" />}
            {state.plansStatus === 'error' && <NativeStateView kind="error" message={state.plansError} onRetry={() => { void model.loadCreationPlans(); }} />}
            {state.plansStatus === 'ready' && state.plans.length === 0 && <NativeStateView kind="empty" message="선택할 수 있는 플랜이 없습니다." />}
            {state.plansStatus === 'ready' && state.plans.map((plan) => <GroupCheckbox key={plan.id} label={plan.name} description={plan.description}
              checked={draft.plan_ids.includes(plan.id)} disabled={state.creating}
              onPress={() => model.editDraft({ plan_ids: draft.plan_ids.includes(plan.id)
                ? draft.plan_ids.filter((id) => id !== plan.id) : [...draft.plan_ids, plan.id] })} />)}
          </ScrollView>
          {state.plansStatus === 'ready' && !draft.plan_ids.length && <Text style={[styles.help, { color: colors.error }]}>최소 1개 이상의 플랜을 선택해주세요.</Text>}
        </View>
        <View style={styles.field}>
          <Text style={labelStyle}>최대 인원</Text>
          <TextInput accessibilityLabel="최대 인원" placeholder="최대 인원 (2-100명)" placeholderTextColor={colors.textMuted}
            keyboardType="number-pad" value={draft.max_members} editable={!state.creating}
            onChangeText={(max_members) => model.editDraft({ max_members })} style={inputStyle} />
        </View>
        <View style={styles.field}>
          <GroupCheckbox label="공개 그룹" checked={draft.is_public} disabled={state.creating}
            onPress={() => model.editDraft({ is_public: !draft.is_public })} />
          <Text style={[styles.help, { color: colors.textSecondary }]}>비공개 그룹은 초대를 통해서만 가입할 수 있습니다.</Text>
        </View>
        {state.createError !== '' && <Text accessibilityRole="alert" style={[styles.help, { color: colors.error }]}>{state.createError}</Text>}
      </View>
    </GroupDialog>
    <GroupDialog visible={state.leaveConfirm} title="그룹 탈퇴" onClose={() => model.cancelLeave()}
      footer={<View style={styles.actions}>
        <GroupButton label="취소" disabled={state.leaving} onPress={() => model.cancelLeave()} />
        <GroupButton label={state.leaving ? '탈퇴 중' : '탈퇴'} variant="danger" loading={state.leaving} onPress={() => { void model.leave(); }} />
      </View>}>
      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.text }]}>정말로 이 그룹에서 탈퇴하시겠습니까?</Text>
        {state.actionError !== '' && <Text accessibilityRole="alert" style={[styles.help, { color: colors.error }]}>{state.actionError}</Text>}
      </View>
    </GroupDialog>
  </>;
}
const styles = StyleSheet.create({
  form: { gap: 20 }, field: { gap: 8 },
  label: { fontFamily: 'Pretendard-Medium', fontSize: 14, fontWeight: '500', lineHeight: 21, letterSpacing: -0.4 },
  input: { minHeight: 39, borderWidth: 1, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, letterSpacing: -0.4 },
  description: { minHeight: 81, textAlignVertical: 'top' },
  help: { fontFamily: 'Pretendard-Regular', fontSize: 12, lineHeight: 18, letterSpacing: -0.4 },
  plans: { maxHeight: 200, borderWidth: 1, borderRadius: 6 },
  planContent: { padding: 12, gap: 12 },
  checkboxRow: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 8, borderRadius: 4 },
  checkbox: { width: 16, height: 16, borderWidth: 1, borderRadius: 3, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxCopy: { flex: 1 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
