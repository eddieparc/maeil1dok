<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import type { components } from '~/types/generated/api-schema'
import { useHead } from '#imports'
import { ChevronDown, Mail } from '@lucide/vue'
import InfoLayout from '~/components/info/InfoLayout.vue'
import ListCard from '~/components/ui/ListCard.vue'
import FilterChip from '~/components/ui/FilterChip.vue'
import AppButton from '~/components/ui/AppButton.vue'

const contactEmail = 'support@maeil1dok.app'
const faqs = [
  { id: 'reading', question: '읽음 표시를 잘못 눌렀어요', answer: '통독표에서 읽음 표시를 다시 누르면 해제할 수 있어요. 여러 날을 한 번에 바꾸려면 일괄수정을 사용해주세요.' },
  { id: 'plans', question: '플랜을 바꾸면 기록이 사라지나요?', answer: '플랜별로 기록이 따로 보관돼요. 플랜을 숨겨도 기록은 유지돼요. 플랜 관리에서 삭제할 때는 기록도 삭제되니 확인해주세요.' },
  { id: 'notifications', question: '알림이 오지 않아요', answer: '계정 설정의 알림에서 오늘 본문 알림이 켜져 있는지, 기기 설정에서 매일일독 알림이 허용되어 있는지 확인해주세요.' },
  { id: 'account', question: '계정을 삭제하고 싶어요', answer: '계정 설정의 계정 삭제에서 요청할 수 있어요. 비밀번호 설정이 필요하며, 삭제 요청 후 30일 안에 다시 로그인하면 삭제가 취소돼요. 30일 이후에는 복구할 수 없어요.' },
]
const openFaqs = ref(['reading'])
function toggleFaq(id: string) {
  openFaqs.value = openFaqs.value.includes(id) ? openFaqs.value.filter(value => value !== id) : [...openFaqs.value, id]
}
const kinds = [
  { value: 'bug', label: '오류 신고' },
  { value: 'feature', label: '기능 제안' },
  { value: 'account', label: '계정 문의' },
  { value: 'other', label: '기타' },
] as const satisfies ReadonlyArray<{ value: components['schemas']['SupportInquiryRequest']['kind']; label: string }>
const api = useApi()
const kind = ref<components['schemas']['SupportInquiryRequest']['kind']>('bug')
const message = ref('')
const email = ref('')
const touched = ref({ message: false, email: false })
const messageError = computed(() => !message.value.trim() ? '문의 내용을 입력해주세요.' : [...message.value.trim()].length > 2000 ? '문의 내용은 2,000자 이내로 입력해주세요.' : '')
const emailError = computed(() => email.value.trim() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) || email.value.trim().length > 254) ? '올바른 이메일 주소를 입력해주세요.' : '')
const canSubmit = computed(() => !messageError.value && !emailError.value)
const pending = ref(false)
const receipt = ref<components['schemas']['SupportInquiryReceipt'] | null>(null)
const fieldErrors = ref<Partial<Record<keyof components['schemas']['SupportInquiryRequest'], string>>>({})
const failureMessages = {
  validation: '입력 내용을 확인해주세요. 문의 내용은 그대로 남아 있어요.',
  auth: '로그인 상태 또는 보안 확인에 실패했어요. 새로고침 전에 문의 내용을 복사해 보관하고, 로그인 상태를 확인한 뒤 다시 시도해주세요.',
  'rate-limit': '문의 접수 횟수 제한에 도달했어요. 잠시 후 다시 시도해주세요. 문의 내용은 그대로 남아 있어요.',
  unavailable: '지금은 문의를 저장하지 못했어요. 잠시 후 다시 시도해주세요. 문의 내용은 그대로 남아 있어요.',
  unknown: '접수 결과를 확인하지 못했어요. 이미 저장되었을 수도 있으며, 다시 보내면 중복 접수될 수 있어요. 문의 내용은 그대로 남아 있어요.',
}
const failure = ref<keyof typeof failureMessages | null>(null)
let draftVersion = 0
let disposed = false
onBeforeUnmount(() => { disposed = true })
watch([kind, message, email], () => {
  draftVersion++
  receipt.value = null
  failure.value = null
  fieldErrors.value = {}
}, { flush: 'sync' })
async function submitInquiry() {
  if (pending.value) return
  touched.value = { message: true, email: true }
  if (!canSubmit.value) return
  receipt.value = null
  failure.value = null
  fieldErrors.value = {}
  pending.value = true
  const submittedVersion = draftVersion
  const payload: components['schemas']['SupportInquiryRequest'] = {
    kind: kind.value,
    message: message.value.trim(),
    ...(email.value.trim() ? { email: email.value.trim() } : {}),
  }
  try {
    const result = await api.POST('/api/v1/support/inquiries/', payload)
    if (disposed || submittedVersion !== draftVersion) return
    // A transport success without the actual generated receipt is not acknowledgement.
    if (!result || result.status !== 'received' || typeof result.receipt_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.receipt_id)) {
      failure.value = 'unknown'
      return
    }
    message.value = ''
    email.value = ''
    touched.value = { message: false, email: false }
    receipt.value = result
  } catch (error: unknown) {
    if (disposed || submittedVersion !== draftVersion) return
    const status = error instanceof Error && 'status' in error ? error.status : undefined
    if (status === 400) {
      failure.value = 'validation'
      const data = error instanceof Error && 'data' in error ? error.data : null
      if (data && typeof data === 'object') {
        for (const field of ['kind', 'message', 'email'] as const) {
          const value: unknown = field in data ? data[field as keyof typeof data] : undefined
          if (Array.isArray(value) && value.every(item => typeof item === 'string')) fieldErrors.value[field] = value.join(' ')
        }
      }
    } else if (status === 401 || status === 403) failure.value = 'auth'
    else if (status === 429) failure.value = 'rate-limit'
    else if (status === 503) failure.value = 'unavailable'
    else failure.value = 'unknown'
  } finally {
    if (!disposed) pending.value = false
  }
}

useHead({
  title: '고객지원 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독 고객지원 페이지입니다. 서비스 이용 중 궁금한 점이나 불편한 점이 있으시면 언제든지 문의해 주세요.' },
    { property: 'og:title', content: '고객지원 - 매일일독' },
    { property: 'og:description', content: '매일일독 고객지원 페이지입니다. 서비스 이용 중 궁금한 점이나 불편한 점이 있으시면 언제든지 문의해 주세요.' },
    { property: 'og:url', content: 'https://maeil1dok.app/support' },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<template>
  <InfoLayout>
    <header class="support-heading">
      <h2>무엇을 도와드릴까요?</h2>
      <p>자주 묻는 질문을 먼저 확인하고, 해결되지 않으면 문의해주세요.</p>
    </header>
    <ListCard title="자주 묻는 질문" :padded="false">
      <div v-for="faq in faqs" :key="faq.id" class="faq-item">
        <h3>
          <button :id="`faq-${faq.id}-toggle`" type="button" :aria-expanded="openFaqs.includes(faq.id)" :aria-controls="`faq-${faq.id}-answer`" @click="toggleFaq(faq.id)">
            <span>{{ faq.question }}</span><ChevronDown :size="18" aria-hidden="true" :class="{ expanded: openFaqs.includes(faq.id) }" />
          </button>
        </h3>
        <p :id="`faq-${faq.id}-answer`" :hidden="!openFaqs.includes(faq.id)" :aria-labelledby="`faq-${faq.id}-toggle`">{{ faq.answer }}</p>
      </div>
    </ListCard>
    <ListCard title="문의 작성">
      <form class="inquiry-form" data-testid="inquiry-form" :aria-busy="pending" novalidate @submit.prevent="submitInquiry">
        <fieldset class="inquiry-kinds" :disabled="pending" :aria-invalid="!!fieldErrors.kind" aria-describedby="inquiry-kind-error">
          <legend>문의 유형</legend>
          <div>
            <FilterChip v-for="option in kinds" :key="option.value" :label="option.label" :active="kind === option.value" :disabled="pending" :data-testid="`inquiry-kind-${option.value}`" @click="kind = option.value" />
          </div>
          <p id="inquiry-kind-error" class="field-error" aria-live="polite">{{ fieldErrors.kind }}</p>
        </fieldset>
        <div class="inquiry-field">
          <label for="inquiry-message">문의 내용 <span>(필수)</span></label>
          <textarea id="inquiry-message" :value="message" :disabled="pending" data-testid="inquiry-message" rows="4" maxlength="2000" required :aria-invalid="touched.message && !!(messageError || fieldErrors.message)" aria-describedby="inquiry-message-hint inquiry-message-error" placeholder="어떤 상황인지 자세히 알려주세요. 비밀번호 등 민감한 정보는 적지 마세요." @input="message = ($event.target as HTMLTextAreaElement).value" @blur="touched.message = true" />
          <p id="inquiry-message-hint" class="field-hint">최대 2,000자 · 비밀번호나 인증 코드는 보내지 마세요.</p>
          <p id="inquiry-message-error" class="field-error" aria-live="polite">{{ touched.message ? messageError || fieldErrors.message : '' }}</p>
        </div>
        <div class="inquiry-field">
          <label for="inquiry-email">답변 이메일 <span>(선택)</span></label>
          <input id="inquiry-email" :value="email" :disabled="pending" data-testid="inquiry-email" type="email" inputmode="email" autocomplete="email" maxlength="254" :aria-invalid="touched.email && !!(emailError || fieldErrors.email)" aria-describedby="inquiry-email-hint inquiry-email-error" placeholder="name@example.com" @input="email = ($event.target as HTMLInputElement).value" @blur="touched.email = true">
          <p id="inquiry-email-hint" class="field-hint">답변을 받을 주소를 직접 입력해주세요. 비워두면 답변 주소 없이 접수되며, 계정 이메일을 자동으로 사용하지 않아요.</p>
          <p id="inquiry-email-error" class="field-error" aria-live="polite">{{ touched.email ? emailError || fieldErrors.email : '' }}</p>
        </div>
        <AppButton type="submit" block :disabled="!canSubmit" :loading="pending" data-testid="inquiry-submit" aria-describedby="inquiry-receipt-note">{{ pending ? '접수 중' : '문의 보내기' }}</AppButton>
        <p id="inquiry-receipt-note" class="field-hint">문의는 서비스에 저장돼요. 접수 번호는 저장 확인이며, 이메일 발송이나 담당자 확인을 뜻하지 않아요.</p>
        <p v-if="pending" role="status" class="field-hint" data-testid="inquiry-pending">접수 결과를 확인하고 있어요.</p>
        <p v-if="receipt" role="status" class="handoff-status" data-testid="inquiry-receipt" :data-status="receipt.status">문의를 접수해 저장했어요. 접수 번호: <span data-testid="inquiry-receipt-id">{{ receipt.receipt_id }}</span></p>
        <p v-if="failure" role="alert" class="field-error" data-testid="inquiry-error" :data-reason="failure">{{ failureMessages[failure] }}</p>
      </form>
    </ListCard>
    <ListCard title="이메일 문의">
      <a class="support-email" :href="`mailto:${contactEmail}`" data-testid="support-email"><Mail :size="18" aria-hidden="true" />{{ contactEmail }}</a>
      <p class="contact-note">운영 시간: 평일 09:00 - 18:00<br>주말 및 공휴일에는 답변이 지연될 수 있습니다.</p>
    </ListCard>
  </InfoLayout>
</template>

<style scoped>
.support-heading h2 { margin: 0 0 8px; font-size: 22px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); }
.support-heading p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--color-text-secondary); }
.faq-item { border-bottom: 1px solid var(--color-border-light); }
.faq-item:last-child { border-bottom: none; }
.faq-item h3 { margin: 0; }
.faq-item button { display: flex; align-items: center; gap: 12px; width: 100%; min-width: var(--hit-min); min-height: 56px; padding: 12px 20px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--color-text-primary); text-align: left; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.faq-item button span { flex: 1; }
.faq-item button:hover, .faq-item button:active { background: var(--color-bg-hover); }
.faq-item svg { flex: none; color: var(--color-text-tertiary); transition: transform var(--duration-micro) ease; }
.faq-item svg.expanded { transform: rotate(180deg); }
.faq-item p { margin: 0; padding: 0 20px 16px; font-size: 13px; line-height: 1.6; color: var(--color-text-secondary); }
.inquiry-form, .inquiry-field { display: flex; flex-direction: column; gap: 12px; }
.inquiry-kinds { margin: 0; padding: 0; border: 0; min-width: 0; }
.inquiry-kinds legend, .inquiry-field label { margin-bottom: 8px; font-size: 13px; font-weight: 600; }
.inquiry-kinds > div { display: flex; flex-wrap: wrap; gap: 6px; }
.inquiry-field { gap: 4px; }
.inquiry-field label span { color: var(--color-text-secondary); font-weight: 400; }
.inquiry-field input, .inquiry-field textarea { box-sizing: border-box; width: 100%; min-width: var(--hit-min); min-height: 48px; padding: 12px 16px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-primary); color: var(--color-text-primary); font: inherit; font-size: 14px; line-height: 1.6; }
.inquiry-field textarea { min-height: 96px; border-radius: var(--radius-control); resize: vertical; }
.inquiry-field input:hover, .inquiry-field textarea:hover { border-color: var(--color-text-tertiary); }
.inquiry-field input:focus, .inquiry-field textarea:focus { border-color: var(--color-accent-primary); background: var(--color-bg-card); }
.inquiry-field input[aria-invalid="true"], .inquiry-field textarea[aria-invalid="true"] { border-color: var(--color-error); }
.inquiry-field input::placeholder, .inquiry-field textarea::placeholder { color: var(--color-text-tertiary); }
.field-hint, .field-error, .handoff-status, .contact-note { margin: 0; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.field-hint, .contact-note { color: var(--color-text-secondary); }
.field-error { color: var(--color-error); }
.field-error:empty { display: none; }
.handoff-status { color: var(--color-accent-primary); padding: 12px; border-radius: var(--radius-control); background: var(--color-accent-bg); }
.support-email { display: inline-flex; align-items: center; gap: 8px; min-width: var(--hit-min); min-height: var(--hit-min); border-radius: var(--radius-control); color: var(--color-accent-primary); font-size: 14px; font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.support-email svg { flex: none; }
.support-email:hover, .support-email:active { background: var(--color-accent-bg); }
.contact-note { margin-top: 8px; }
@media (prefers-reduced-motion: reduce) { .faq-item svg { transition: none; } }
</style>
