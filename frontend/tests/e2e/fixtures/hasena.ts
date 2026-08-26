import type { components } from '../../../app/types/generated/api-schema';
import type { ApiMock } from './api';

const HASENA_VIDEO_ID = 'A83cdGOhMdt';

const hasenaSummary = {
  success: true,
  video_id: HASENA_VIDEO_ID,
  summary: '브라우저 하세나 요약',
  model: 'playwright-fixture',
  is_edited: false,
  video_date: '2026-08-26',
  title: '하세나하시조',
  persisted: true,
  cacheable: true,
} satisfies components['schemas']['HasenaSummaryResponse'];

const hasenaStats = {
  success: true,
  data: {
    total_completed: 21,
    current_streak: 3,
    longest_streak: 8,
  },
} satisfies components['schemas']['HasenaStatsResponse'];

const hasenaUpdate = {
  success: true,
  data: {
    id: 41,
    date: '2026-08-26',
    is_completed: true,
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
  },
} satisfies components['schemas']['HasenaRecordUpdateResponse'];

const readingDetail = {
  book: 'jhn',
  book_kor: '요한복음',
  book_unit_kor: '장',
  chapter: '3',
  is_logined: true,
  plan_id: 7,
  plan_name: '브라우저 통독',
  plan_date: '2026-08-26',
  is_complete: false,
  plan_detail: [
    {
      book: 'jhn',
      book_kor: '요한복음',
      book_unit_kor: '장',
      start_chapter: 3,
      end_chapter: 3,
      schedule_id: 13,
      date: '2026-08-26',
      is_complete: false,
    },
  ],
} satisfies components['schemas']['ChapterDetailResponse'];

const readingUpdate = {
  success: true,
  plan_id: '7',
  schedule_ids: ['13'],
  is_completed: true,
} satisfies components['schemas']['ProgressUpdateResponse'];

const certification = {
  success: true,
  user: {
    id: 7,
    nickname: '브라우저 독자',
  },
  plan: {
    id: 7,
    name: '브라우저 통독',
  },
  period: {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
  },
  progress: {
    totalSchedules: 30,
    completedSchedules: 18,
    completionRate: 60,
    currentStreak: 4,
    totalCompletedDays: 18,
    latestCompletedAt: '2026-08-26T00:00:00+09:00',
    status: 'in_progress',
  },
  card: {
    title: '오늘 통독 완료',
    subtitle: '오늘도 말씀을 읽었습니다',
    readingRange: '요한복음 3장',
    dateLabel: '2026-08-26',
    footer: '매일 말씀을 읽는 작은 습관',
  },
} satisfies components['schemas']['CertificationProgressResponse'];

const notes = {
  success: true,
  notes: [],
} satisfies components['schemas']['ReflectionNoteByChapterResponse'];

const highlights = {
  success: true,
  highlights: [],
} satisfies components['schemas']['BibleHighlightByChapterResponse'];

const bookmarks = {
  success: true,
  bookmarks: [],
} satisfies components['schemas']['BibleBookmarkByChapterResponse'];

const readingPositionSaved = {
  success: true,
  message: 'saved',
} satisfies components['schemas']['TodoSuccessMessageResponse'];

const noPlanSubscriptions = [] satisfies components['schemas']['PlanSubscriptionListResponse'][];

export const mockHasenaPage = (api: ApiMock, completed = false): void => {
  const day = {
    success: true,
    entry: {
      id: 31,
      date: '2026-08-26',
      passage: '요한복음 3장',
      video_id: HASENA_VIDEO_ID,
      title: '하세나하시조',
      body_text: '하나님이 세상을 이처럼 사랑하사',
      verses: [
        {
          number: '16',
          verse: 16,
          text: '하나님이 세상을 이처럼 사랑하사',
        },
      ],
      source_url: 'https://example.com/hasena/2026-08-26',
      body_source_url: 'https://example.com/hasena/2026-08-26/body',
      fetched_at: '2026-08-26T00:00:00Z',
    },
    is_completed: completed,
  } satisfies components['schemas']['HasenaDayResponse'];

  api.get('/api/v1/todos/hasena/day/', day);
  api.get('/api/v1/todos/hasena/summary/', hasenaSummary);
  api.get('/api/v1/todos/hasena/stats/', hasenaStats);
  api.post('/api/v1/todos/hasena/update/', hasenaUpdate);
};

export const mockTongdokCertification = (api: ApiMock): void => {
  api.get('/api/v1/todos/detail/', readingDetail);
  api.post('/api/v1/todos/reading/update/', readingUpdate);
  api.get('/api/v1/todos/certification/progress/', certification);
  api.get('/api/v1/todos/bible/notes/by-chapter/', notes);
  api.get('/api/v1/todos/bible/highlights/by-chapter/', highlights);
  api.get('/api/v1/todos/bible/bookmarks/by-chapter/', bookmarks);
  api.post('/api/v1/todos/bible/reading-position/', readingPositionSaved);
  api.get('/api/v1/todos/plan/', noPlanSubscriptions);
};
