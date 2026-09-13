import { onUnmounted, ref, watch, type Ref } from 'vue'
import { useApi } from '~/composables/useApi'

/** UI-only availability: a reply belongs to one exact input, never the next one. */
export function useAuthNicknameField(nickname: Ref<string>) {
  const api = useApi()
  const nicknameError = ref('')
  const isNicknameChecked = ref(false)
  const checkingNickname = ref(false)
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function checkNickname() {
    const request = ++generation
    clearTimeout(timer)
    nicknameError.value = ''
    isNicknameChecked.value = false
    checkingNickname.value = false
    const value = nickname.value.trim()
    if (!value) return
    if (value.length < 2 || value.length > 20) {
      nicknameError.value = '닉네임은 2자 이상 20자 이하로 입력해주세요.'
      return
    }
    checkingNickname.value = true
    timer = setTimeout(async () => {
      try {
        const response = await api.POST('/api/v1/auth/check-nickname/', { nickname: value })
        if (request !== generation) return
        isNicknameChecked.value = response.available === true
        if (!isNicknameChecked.value) nicknameError.value = '이미 사용 중인 닉네임이에요.'
      } catch {
        if (request !== generation) return
        nicknameError.value = '닉네임을 확인하지 못했어요. 다시 확인해주세요.'
      } finally {
        if (request === generation) checkingNickname.value = false
      }
    }, 300)
  }
  watch(nickname, checkNickname, { flush: 'sync' })
  onUnmounted(() => { ++generation; clearTimeout(timer) })
  return { nicknameError, isNicknameChecked, checkingNickname, checkNickname }
}
