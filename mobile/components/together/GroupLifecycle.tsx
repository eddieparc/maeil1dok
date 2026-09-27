import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeButton } from '../ui/NativeButton';
import { NativeSheet } from '../ui/NativeSheet';
import { NativeStateView } from '../ui/NativeStateView';
import { typography, useNativeColors } from '../ui/tokens';
import type { TogetherModel, TogetherState } from './TogetherModel';

export function GroupLifecycle({ model, state }: {
  readonly model: TogetherModel;
  readonly state: TogetherState;
}) {
  const colors = useNativeColors();
  const inputStyle = [styles.input, typography.body, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  const labelStyle = [typography.label, { color: colors.text }];
  const draft = state.draft;
  return <>
    <NativeSheet visible={state.createOpen} title="새 그룹 만들기" onClose={() => model.closeCreate()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.form}>
          <Text style={labelStyle}>그룹 이름</Text>
          <TextInput accessibilityLabel="그룹 이름" value={draft.name} maxLength={100} editable={!state.creating}
            onChangeText={(name) => model.editDraft({ name })} style={inputStyle} />
          <Text style={labelStyle}>설명 (선택)</Text>
          <TextInput accessibilityLabel="그룹 설명" value={draft.description} maxLength={500} multiline editable={!state.creating}
            onChangeText={(description) => model.editDraft({ description })} style={inputStyle} />
          <Text style={labelStyle}>성경 읽기 플랜 (복수 선택)</Text>
          {state.plansStatus === 'loading' && <NativeStateView kind="loading" message="플랜을 불러오는 중" />}
          {state.plansStatus === 'error' && <NativeStateView kind="error" message={state.plansError} onRetry={() => { void model.loadCreationPlans(); }} />}
          {state.plansStatus === 'ready' && state.plans.length === 0 && <NativeStateView kind="empty" message="선택할 수 있는 플랜이 없습니다." />}
          {state.plansStatus === 'ready' && state.plans.map((plan) => <NativeButton key={plan.id} label={plan.name}
            selected={draft.plan_ids.includes(plan.id)} disabled={state.creating}
            onPress={() => model.editDraft({ plan_ids: draft.plan_ids.includes(plan.id)
              ? draft.plan_ids.filter((id) => id !== plan.id) : [...draft.plan_ids, plan.id] })} />)}
          <Text style={labelStyle}>최대 인원 (2~100명)</Text>
          <TextInput accessibilityLabel="최대 인원" keyboardType="number-pad" value={draft.max_members} editable={!state.creating}
            onChangeText={(max_members) => model.editDraft({ max_members })} style={inputStyle} />
          <NativeButton label="공개 그룹" selected={draft.is_public} disabled={state.creating}
            onPress={() => model.editDraft({ is_public: !draft.is_public })} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>비공개 그룹은 초대를 통해서만 가입할 수 있습니다.</Text>
          {state.createError !== '' && <NativeStateView kind="error" message={state.createError} />}
          <NativeButton label={state.creating ? '생성 중' : '그룹 만들기'} selected
            disabled={state.creating || state.plansStatus !== 'ready' || state.plans.length === 0}
            onPress={() => { void model.create(); }} />
          <NativeButton label="취소" disabled={state.creating} onPress={() => model.closeCreate()} />
        </View>
      </KeyboardAvoidingView>
    </NativeSheet>
    <NativeSheet visible={state.leaveConfirm} title="그룹 탈퇴" onClose={() => model.cancelLeave()}>
      <View style={styles.form}>
        <Text style={[typography.body, { color: colors.text }]}>정말로 이 그룹에서 탈퇴하시겠습니까?</Text>
        {state.actionError !== '' && <NativeStateView kind="error" message={state.actionError} />}
        <NativeButton label={state.leaving ? '탈퇴 중' : '탈퇴'} disabled={state.leaving}
          onPress={() => { void model.leave(); }} />
        <NativeButton label="취소" disabled={state.leaving} onPress={() => model.cancelLeave()} />
      </View>
    </NativeSheet>
  </>;
}
const styles = StyleSheet.create({
  form: { gap: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 12 },
});
