export interface DjangoUser {
  id: number
  email: string
  nickname: string
  is_social: boolean
  social_provider: string | null
  social_id: string | null
  profile_image: string | null
  is_active: boolean
  date_joined: string
  is_staff: boolean
  is_superuser: boolean
  scheduled_deletion_at: string | null
  merged_into_id: number | null
}

export interface DjangoSocialAccount {
  id: number
  user_id: number
  provider: string
  provider_id: string
  email: string | null
}

export interface DjangoUserProfile {
  id: number
  user_id: number
  bio: string | null
  total_completed_days: number
  current_streak: number
  longest_streak: number
  is_public: boolean
  joined_date: string | null
}

export interface DjangoBibleReadingPlan {
  id: number
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_by_id: number | null
}

export interface DjangoPlanSubscription {
  id: number
  user_id: number
  plan_id: number
  start_date: string
  is_active: boolean
}

export interface DjangoDailyBibleSchedule {
  id: number
  plan_id: number
  date: string
  book: string
  start_chapter: number
  end_chapter: number
  audio_link: string | null
  guide_link: string | null
}

export interface DjangoUserBibleProgress {
  id: number
  subscription_id: number
  schedule_id: number
  is_completed: boolean
  completed_at: string | null
}

export interface DjangoVideoBibleIntro {
  id: number
  plan_id: number
  book: string
  youtube_id: string
  title: string | null
  order: number
}

export interface DjangoUserVideoIntroProgress {
  id: number
  user_id: number
  video_intro_id: number
  is_watched: boolean
  watched_at: string | null
}

export interface DjangoHasenaRecord {
  id: number
  user_id: number
  date: string
  watched: boolean
  watched_at: string | null
}

export interface DjangoHasenaSummary {
  id: number
  date: string
  youtube_id: string
  title: string | null
}

export interface DjangoCatchupSession {
  id: number
  subscription_id: number
  strategy: string
  target_date: string
  created_at: string
  completed_at: string | null
}

export interface DjangoCatchupSchedule {
  id: number
  session_id: number
  original_schedule_id: number
  order: number
}

export interface DjangoUserPlanDisplaySettings {
  id: number
  user_id: number
  subscription_id: number
  is_primary: boolean
  display_order: number
}

export interface DjangoUserReadingPosition {
  id: number
  user_id: number
  book: string
  chapter: number
  updated_at: string
}

export interface DjangoUserReadingSettings {
  id: number
  user_id: number
  theme: string
  font_family: string
  font_size: string
}

export interface DjangoBibleBookmark {
  id: number
  user_id: number
  bookmark_type: string
  book: string
  chapter: number
  start_verse: number | null
  end_verse: number | null
  title: string
  color: string
  created_at: string
  updated_at: string
}

export interface DjangoReflectionNote {
  id: number
  user_id: number
  book: string
  chapter: number
  start_verse: number | null
  end_verse: number | null
  content: string
  is_private: boolean
  created_at: string
  updated_at: string
}

export interface DjangoPersonalReadingRecord {
  id: number
  user_id: number
  book: string
  chapter: number
  read_date: string
  created_at: string
}

export interface DjangoBibleHighlight {
  id: number
  user_id: number
  book: string
  chapter: number
  start_verse: number
  end_verse: number
  color: string
  memo: string
  created_at: string
  updated_at: string
}

export interface DjangoFollow {
  id: number
  follower_id: number
  following_id: number
  created_at: string
}

export interface UserMapping {
  django_user_id: number
  supabase_user_id: string
}

export interface ExtractionSummary {
  [tableName: string]: number
}
