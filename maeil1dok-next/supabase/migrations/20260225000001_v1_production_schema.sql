CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  bio TEXT DEFAULT '',
  total_completed_days INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bible_reading_plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES public.bible_reading_plans(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id)
);

CREATE TABLE public.daily_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id INTEGER NOT NULL REFERENCES public.bible_reading_plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  book TEXT NOT NULL,
  start_chapter INTEGER NOT NULL,
  end_chapter INTEGER NOT NULL,
  audio_link TEXT,
  guide_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.plan_subscriptions(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.daily_schedules(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_plan_display_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.plan_subscriptions(id) ON DELETE CASCADE UNIQUE,
  color VARCHAR(7) DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_reading_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  font_family TEXT DEFAULT 'kopub-batang',
  font_size INTEGER DEFAULT 16,
  font_weight TEXT DEFAULT 'medium',
  line_height NUMERIC DEFAULT 1.6,
  text_align TEXT DEFAULT 'left',
  verse_joining BOOLEAN DEFAULT false,
  show_verse_numbers BOOLEAN DEFAULT true,
  show_description BOOLEAN DEFAULT true,
  show_cross_ref BOOLEAN DEFAULT true,
  highlight_names BOOLEAN DEFAULT true,
  show_footnotes BOOLEAN DEFAULT false,
  tongdok_auto_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_reading_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER,
  scroll_position NUMERIC DEFAULT 0,
  version TEXT DEFAULT 'GAE',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.video_bible_intros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id INTEGER NOT NULL REFERENCES public.bible_reading_plans(id) ON DELETE CASCADE,
  book TEXT NOT NULL,
  url_link TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, book)
);

CREATE TABLE public.user_video_intro_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_intro_id UUID NOT NULL REFERENCES public.video_bible_intros(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, video_intro_id)
);

CREATE TABLE public.hasena_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE public.hasena_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,
  video_date DATE,
  title TEXT DEFAULT '',
  summary TEXT NOT NULL,
  transcript TEXT DEFAULT '',
  model_used TEXT DEFAULT 'gemini-2.0-flash',
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.catchup_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.plan_subscriptions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  range_start DATE NOT NULL,
  range_end DATE NOT NULL,
  strategy TEXT DEFAULT 'parallel' CHECK (strategy IN ('parallel', 'sequential')),
  target_rejoin_date DATE,
  max_daily_readings INTEGER,
  max_daily_chapters INTEGER,
  weekend_multiplier NUMERIC DEFAULT 1.0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.catchup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.catchup_sessions(id) ON DELETE CASCADE,
  original_schedule_id UUID REFERENCES public.daily_schedules(id),
  scheduled_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, original_schedule_id)
);

CREATE TABLE public.bible_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'ko',
  version TEXT NOT NULL DEFAULT 'GAE',
  content JSONB NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book, chapter, language, version)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_reading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plan_display_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reading_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reading_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_bible_intros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_video_intro_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasena_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasena_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catchup_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catchup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_content_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view active plans" ON public.bible_reading_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Service role can manage plans" ON public.bible_reading_plans FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own subscriptions" ON public.plan_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.plan_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.plan_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON public.plan_subscriptions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view schedules" ON public.daily_schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage schedules" ON public.daily_schedules FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own progress" ON public.user_progress FOR SELECT USING (
  auth.uid() = (SELECT user_id FROM public.plan_subscriptions WHERE id = subscription_id)
);
CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.plan_subscriptions WHERE id = subscription_id)
);
CREATE POLICY "Users can update own progress" ON public.user_progress FOR UPDATE USING (
  auth.uid() = (SELECT user_id FROM public.plan_subscriptions WHERE id = subscription_id)
);

CREATE POLICY "Users can manage own display settings" ON public.user_plan_display_settings FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own reading settings" ON public.user_reading_settings FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own reading positions" ON public.user_reading_positions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view video intros" ON public.video_bible_intros FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage video intros" ON public.video_bible_intros FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own video progress" ON public.user_video_intro_progress FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own hasena records" ON public.hasena_records FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view hasena summaries" ON public.hasena_summaries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage hasena summaries" ON public.hasena_summaries FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own catchup sessions" ON public.catchup_sessions FOR SELECT USING (
  auth.uid() = (SELECT user_id FROM public.plan_subscriptions WHERE id = subscription_id)
);
CREATE POLICY "Users can insert own catchup sessions" ON public.catchup_sessions FOR INSERT WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.plan_subscriptions WHERE id = subscription_id)
);
CREATE POLICY "Users can update own catchup sessions" ON public.catchup_sessions FOR UPDATE USING (
  auth.uid() = (SELECT user_id FROM public.plan_subscriptions WHERE id = subscription_id)
);

CREATE POLICY "Users can view own catchup schedules" ON public.catchup_schedules FOR SELECT USING (
  auth.uid() = (
    SELECT ps.user_id FROM public.plan_subscriptions ps
    JOIN public.catchup_sessions cs ON cs.subscription_id = ps.id
    WHERE cs.id = session_id
  )
);
CREATE POLICY "Users can manage own catchup schedules" ON public.catchup_schedules FOR ALL USING (
  auth.uid() = (
    SELECT ps.user_id FROM public.plan_subscriptions ps
    JOIN public.catchup_sessions cs ON cs.subscription_id = ps.id
    WHERE cs.id = session_id
  )
);

CREATE POLICY "Anyone can read bible content" ON public.bible_content_cache FOR SELECT USING (true);
CREATE POLICY "Service role can manage bible content" ON public.bible_content_cache FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_plan_subscriptions_user_id ON public.plan_subscriptions(user_id);
CREATE INDEX idx_daily_schedules_plan_date ON public.daily_schedules(plan_id, date);
CREATE INDEX idx_user_progress_subscription_completed ON public.user_progress(subscription_id, is_completed);
CREATE INDEX idx_user_progress_subscription ON public.user_progress(subscription_id);
CREATE INDEX idx_catchup_sessions_subscription_status ON public.catchup_sessions(subscription_id, status);
CREATE INDEX idx_catchup_schedules_session_date ON public.catchup_schedules(session_id, scheduled_date);
