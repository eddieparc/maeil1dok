import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { NativeButton } from '../ui/NativeButton';
import { NativeSheet } from '../ui/NativeSheet';
import { spacing, typography, useNativeColors } from '../ui/tokens';
import type { ProfileController } from './profileController';
import type { ReadyProfile } from './profileTypes';

export function ProfileEditor({ state, controller }: {
  readonly state: ReadyProfile; readonly controller: ProfileController;
}) {
  const colors = useNativeColors();
  const draft = state.editor;
  return <NativeSheet visible={draft !== null} title="프로필 편집" onClose={controller.closeEdit}>
    {draft && <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.form}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>프로필 이미지는 소셜 로그인 계정에서 가져와요.</Text>
        <Text style={[typography.label, { color: colors.text }]}>닉네임</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{state.profile.user.nickname}</Text>
        <Text style={[typography.label, { color: colors.text }]}>자기소개</Text>
        <TextInput testID="profile-bio" accessibilityLabel="자기소개" multiline maxLength={500}
          editable={!draft.saving} value={draft.bio} placeholder="자신을 소개해 주세요"
          placeholderTextColor={colors.textMuted} textAlignVertical="top"
          onChangeText={bio => controller.edit({ bio, is_public: draft.is_public })}
          style={[typography.body, styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{draft.bio.length}/500</Text>
        <View style={styles.row}>
          <Text style={[typography.label, { color: colors.text }]}>프로필 공개</Text>
          <Switch accessibilityLabel="프로필 공개" value={draft.is_public} disabled={draft.saving}
            onValueChange={is_public => controller.edit({ bio: draft.bio, is_public })} />
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>비공개로 설정하면 나만 프로필을 볼 수 있어요.</Text>
        {draft.error && <Text accessibilityRole="alert" style={[typography.body, { color: colors.error }]}>{draft.error}</Text>}
        <View style={styles.row}>
          <NativeButton label="취소" disabled={draft.saving} onPress={controller.closeEdit} />
          <NativeButton label={draft.saving ? '저장 중' : '저장'} disabled={draft.saving || draft.bio.length > 500}
            onPress={() => { void controller.save(); }} />
        </View>
      </View>
    </KeyboardAvoidingView>}
  </NativeSheet>;
}
const styles = StyleSheet.create({
  form: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: spacing.md },
});
