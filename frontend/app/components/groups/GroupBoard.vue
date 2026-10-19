<script setup lang="ts">
import { computed } from 'vue'
import { useGroupBoard } from '~/composables/useGroupBoard'
import AppButton from '~/components/ui/AppButton.vue'
import ListCard from '~/components/ui/ListCard.vue'
import Skeleton from '~/components/ui/Skeleton.vue'

const props = defineProps<{ groupId: number; member?: boolean }>()
const board = useGroupBoard(() => props)
const { posts, post, view, page, count, hasNext, loading, saving, failure, message, draft, fields, access } = board
const loginUrl = computed(() => `/login?redirect=${encodeURIComponent(`/groups/${props.groupId}?tab=board`)}`)
const editing = computed(() => view.value === 'create' || view.value === 'edit')
const date = (value: string) => value.replace('T', ' ').slice(0, 16)
</script>

<template>
  <section class="group-board" :data-board-view="view" :data-board-access="access" aria-label="그룹 게시판">
    <ListCard v-if="access === 'loading'">
      <p role="status">로그인 상태를 확인하는 중이에요.</p>
      <Skeleton height="56px" />
    </ListCard>
    <ListCard v-else-if="access === 'login'">
      <h3>로그인이 필요해요</h3>
      <p>로그인 후 그룹 게시판을 이용해 주세요.</p>
      <AppButton :to="loginUrl" data-action="board-login">로그인</AppButton>
    </ListCard>
    <ListCard v-else-if="access === 'offline'">
      <p role="alert">로그인 상태를 확인하지 못했어요.</p>
      <AppButton variant="secondary" data-action="board-auth-retry" @click="board.revalidate()">다시 확인</AppButton>
    </ListCard>
    <ListCard v-else-if="access === 'denied'">
      <h3>그룹 멤버만 볼 수 있어요</h3>
      <p>그룹에 가입한 후 게시판을 이용해 주세요.</p>
    </ListCard>
    <template v-else>
      <div class="board-toolbar">
        <h3>{{ view === 'list' ? '게시판' : view === 'create' ? '글쓰기' : view === 'edit' ? '게시글 수정' : '게시글' }}</h3>
        <AppButton v-if="view === 'list' && !failure" data-action="board-create" :disabled="loading" @click="board.edit(true)">글쓰기</AppButton>
        <AppButton v-else-if="!editing" variant="ghost" data-action="board-list" :disabled="saving" @click="board.loadList()">목록</AppButton>
      </div>
      <ListCard v-if="failure" :data-board-failure="failure">
        <p role="alert">{{ message }}</p>
        <AppButton v-if="failure === 'login'" :to="loginUrl" data-action="board-login">로그인</AppButton>
        <AppButton v-else-if="!editing" variant="secondary" data-action="board-retry" :disabled="loading || saving" @click="board.retry()">다시 시도</AppButton>
        <AppButton v-if="view === 'list' && page > 1" variant="ghost" data-action="board-first" @click="board.loadList(1)">첫 페이지</AppButton>
      </ListCard>
      <ListCard v-if="loading" aria-busy="true" data-board-loading>
        <p role="status">게시글을 불러오는 중이에요.</p>
        <Skeleton v-for="i in 3" :key="i" height="56px" />
      </ListCard>
      <ListCard v-else-if="editing">
        <form class="board-form" data-action="board-form" @submit.prevent="board.save">
          <div>
            <label class="form-label" for="group-post-title">제목</label>
            <input id="group-post-title" v-model="draft.title" class="input-field" name="title" required
              :disabled="saving" :aria-invalid="!!fields.title" aria-describedby="group-post-title-error" />
            <p id="group-post-title-error" class="error-text" role="alert">{{ fields.title }}</p>
          </div>
          <div>
            <label class="form-label" for="group-post-content">내용</label>
            <textarea id="group-post-content" v-model="draft.content" class="input-field" name="content" rows="12" required
              :disabled="saving" :aria-invalid="!!fields.content" aria-describedby="group-post-content-error group-post-limit" />
            <p id="group-post-content-error" class="error-text" role="alert">{{ fields.content }}</p>
            <p id="group-post-limit" class="board-meta">제목 200자 · 내용 10,000자까지</p>
          </div>
          <div class="board-actions">
            <AppButton type="submit" data-action="board-save" :loading="saving">저장</AppButton>
            <AppButton variant="ghost" data-action="board-cancel" :disabled="saving" @click="board.cancel">취소</AppButton>
          </div>
        </form>
      </ListCard>
      <ListCard v-else-if="view === 'detail' && post" :data-board-post="post.id">
        <article>
          <h2 class="post-title">{{ post.title }}</h2>
          <p class="board-meta">{{ post.author.nickname }} · <time :datetime="post.created_at">{{ date(post.created_at) }}</time></p>
          <p class="post-content" data-post-content>{{ post.content }}</p>
          <div class="board-actions">
            <AppButton v-if="post.can_edit" variant="secondary" data-action="board-edit" :disabled="saving" @click="board.edit()">수정</AppButton>
            <AppButton v-if="post.can_delete" variant="danger" data-action="board-delete" :loading="saving" @click="board.remove">삭제</AppButton>
          </div>
        </article>
      </ListCard>
      <template v-else-if="view === 'list' && !failure">
        <ListCard v-if="!posts.length" data-board-empty>
          <h3>아직 게시글이 없어요</h3>
          <p>그룹에 나누고 싶은 이야기를 남겨 주세요.</p>
        </ListCard>
        <ListCard v-else :padded="false">
          <ul class="board-posts">
            <li v-for="item in posts" :key="item.id">
              <button type="button" class="board-post" :data-post-id="item.id" @click="board.open(item.id)">
                <span class="post-title">{{ item.title }}</span>
                <span class="board-meta">{{ item.author.nickname }} · {{ date(item.created_at) }}</span>
              </button>
            </li>
          </ul>
        </ListCard>
        <nav v-if="count > 0" class="board-pagination" aria-label="게시판 페이지">
          <AppButton variant="secondary" data-action="board-previous" :disabled="page <= 1" @click="board.paginate(-1)">이전</AppButton>
          <span aria-live="polite" data-board-page>{{ page }} / {{ Math.max(1, Math.ceil(count / 20)) }}</span>
          <AppButton variant="secondary" data-action="board-next" :disabled="!hasNext" @click="board.paginate(1)">다음</AppButton>
        </nav>
      </template>
    </template>
  </section>
</template>

<style scoped>
.group-board, .board-form { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.group-board { color: var(--color-text-primary); font-size: 14px; line-height: 1.5; }
.group-board h3 { margin: 0; font-size: 15px; font-weight: 700; }
.board-toolbar, .board-actions, .board-pagination { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.board-toolbar { justify-content: space-between; }
.board-pagination { justify-content: center; font-variant-numeric: tabular-nums; }
.board-posts { list-style: none; margin: 0; padding: 0; }
.board-posts li + li { border-top: 1px solid var(--color-border-light); }
.board-post { display: flex; flex-direction: column; gap: 8px; width: 100%; min-height: 56px; padding: 16px 20px; text-align: left; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
.board-post:hover { background: var(--color-bg-hover); }
.board-post:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: -3px; }
.post-title { margin: 0; font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
.board-meta { color: var(--color-text-secondary); font-size: 12px; overflow-wrap: anywhere; }
.post-content { white-space: pre-wrap; overflow-wrap: anywhere; margin: 24px 0; font-size: 15px; line-height: 1.75; }
.board-form textarea { resize: vertical; min-height: 160px; }
.board-form .input-field { box-sizing: border-box; max-width: 100%; }
@media (max-width: 767px) {
  .group-board, .group-board h3, .post-title, .post-content { font-size: 17px; }
  .board-meta { font-size: 15px; }
  .board-form .input-field { font-size: inherit; }
}
</style>
