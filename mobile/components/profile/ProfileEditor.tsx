import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProfileSheet } from './ProfileSheet';
import { ProfileAvatar, ProfileButton, ProfileIcon, profileText, useProfileColors } from './ProfilePrimitives';
import type { ProfileController } from './profileController';
import type { ReadyProfile } from './profileTypes';

export function ProfileEditor({ state, controller }: {
  readonly state: ReadyProfile; readonly controller: ProfileController;
}) {
  const colors = useProfileColors();
  const draft = state.editor;
  return <ProfileSheet visible={draft !== null} title="프로필 편집" onClose={controller.closeEdit}
    footer={draft && <View style={styles.footer}>
      <ProfileButton label="취소" disabled={draft.saving} onPress={controller.closeEdit} />
      <ProfileButton label={draft.saving ? '저장 중' : '저장'} primary disabled={state.refreshing || draft.saving || draft.bio.length > 500}
        onPress={() => { void controller.save(); }} />
    </View>}>
    {draft && <View style={styles.form}>
      <View style={styles.group}>
        <Text style={[profileText.small, { color: colors.textSecondary }]}>프로필 이미지</Text>
        <View style={styles.avatarRow}>
          <ProfileAvatar uri={state.profile.user.profile_image} name={state.profile.user.nickname}
            failed={state.avatarFailed} onError={controller.avatarFailed} />
          <Text style={[profileText.body, { color: colors.textSecondary, flex: 1 }]}>소셜 로그인 계정에서 가져와요.</Text>
        </View>
      </View>
      <View style={styles.group}>
        <Text style={[profileText.small, { color: colors.textSecondary }]}>닉네임</Text>
        <TextInput accessibilityLabel="닉네임" editable={false} value={state.profile.user.nickname}
          style={[styles.nickname, { color: colors.textMuted, backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} />
      </View>
      <View style={styles.group}>
        <Text style={[profileText.small, { color: colors.textSecondary }]}>자기소개</Text>
        <TextInput testID="profile-bio" accessibilityLabel="자기소개" multiline maxLength={500}
          editable={!draft.saving} value={draft.bio} placeholder="자신을 소개해 주세요 (최대 500자)"
          placeholderTextColor={colors.textMuted} textAlignVertical="top"
          onChangeText={bio => controller.edit({ bio, is_public: draft.is_public })}
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} />
        <Text style={[profileText.body, styles.count, { color: colors.textSecondary }]}>{draft.bio.length}/500</Text>
      </View>
      <View style={styles.group}>
        <Pressable testID="profile-public" accessibilityRole="checkbox" accessibilityLabel="프로필 공개"
          accessibilityState={{ checked: draft.is_public, disabled: draft.saving }} disabled={draft.saving}
          onPress={() => controller.edit({ bio: draft.bio, is_public: !draft.is_public })} style={styles.checkboxRow}>
          <View style={[styles.checkbox, { borderColor: draft.is_public ? colors.accent : colors.border,
            backgroundColor: draft.is_public ? colors.accent : 'transparent' }]}>
            {draft.is_public && <ProfileIcon name="check" size={14} color={colors.onAccent} />}
          </View>
          <Text style={[profileText.body, { fontSize: 15, color: colors.text }]}>프로필 공개</Text>
        </Pressable>
        <Text style={[profileText.body, styles.hint, { color: colors.textSecondary }]}>비공개로 설정하면 나만 프로필을 볼 수 있어요.</Text>
      </View>
      {draft.error && <Text accessibilityRole="alert" style={[profileText.body, { color: colors.error }]}>{draft.error}</Text>}
    </View>}
  </ProfileSheet>;
}
const styles = StyleSheet.create({
  form: { gap: 20 },
  group: { gap: 8 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  nickname: { minHeight: 44, borderWidth: 1, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, fontFamily: 'Pretendard-Regular', fontSize: 15 },
  input: { minHeight: 100, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, fontFamily: 'Pretendard-Regular', fontSize: 15, lineHeight: 22.5 },
  count: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  hint: { marginLeft: 28 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
