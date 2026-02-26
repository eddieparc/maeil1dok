-- =============================================================================
-- Migration: Triggers + Seed Data
-- Signal #1: User Created → Profile Created
-- Signal #3: Subscription Created → Display Settings Created
-- Signal #4 (stats): Progress Updated → Profile Stats Updated
-- Seed: 1 Bible reading plan + 7 daily schedules (Genesis 1-7)
-- =============================================================================

-- =============================================================================
-- Signal #1: Auto-create profile when new user signs up
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- Signal #3: Auto-create display settings when user subscribes to plan
-- Uses ACTUAL Django PLAN_COLORS HEX values (8 colors from backend/todos/constants.py)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS TRIGGER AS $$
DECLARE
  plan_colors TEXT[] := ARRAY[
    '#3B82F6',  -- Blue (기본)
    '#10B981',  -- Green
    '#F59E0B',  -- Amber
    '#EF4444',  -- Red
    '#8B5CF6',  -- Purple
    '#EC4899',  -- Pink
    '#06B6D4',  -- Cyan
    '#F97316'   -- Orange
  ];
  subscription_count INTEGER;
  color_index INTEGER;
BEGIN
  -- Count existing subscriptions for this user to pick color
  SELECT COUNT(*) INTO subscription_count
  FROM public.plan_subscriptions
  WHERE user_id = new.user_id;

  -- Pick color based on subscription count (cycling through 8 colors)
  color_index := (subscription_count % 8) + 1;

  INSERT INTO public.user_plan_display_settings (user_id, subscription_id, color, display_order)
  VALUES (new.user_id, new.id, plan_colors[color_index], subscription_count);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_plan_subscription_created
  AFTER INSERT ON public.plan_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_subscription();

-- =============================================================================
-- Signal #4 (stats): Update profile stats when reading progress changes
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_user_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_total_days INTEGER;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_prev_streak INTEGER := 0;
  v_streak_running INTEGER := 0;
  v_progress_date DATE;
  v_prev_date DATE;
BEGIN
  -- Get user_id through the FK chain
  SELECT ps.user_id INTO v_user_id
  FROM public.plan_subscriptions ps
  WHERE ps.id = NEW.subscription_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total completed days across all subscriptions
  SELECT COUNT(DISTINCT ds.date) INTO v_total_days
  FROM public.user_progress up
  JOIN public.plan_subscriptions ps ON ps.id = up.subscription_id
  JOIN public.daily_schedules ds ON ds.id = up.schedule_id
  WHERE ps.user_id = v_user_id
    AND up.is_completed = true;

  -- Calculate current streak (consecutive completed days ending today or yesterday)
  WITH completed_dates AS (
    SELECT DISTINCT ds.date
    FROM public.user_progress up
    JOIN public.plan_subscriptions ps ON ps.id = up.subscription_id
    JOIN public.daily_schedules ds ON ds.id = up.schedule_id
    WHERE ps.user_id = v_user_id
      AND up.is_completed = true
    ORDER BY ds.date DESC
  ),
  streaks AS (
    SELECT
      date,
      date - (ROW_NUMBER() OVER (ORDER BY date))::INTEGER AS streak_group
    FROM completed_dates
  )
  SELECT COUNT(*) INTO v_current_streak
  FROM streaks
  WHERE streak_group = (
    SELECT streak_group FROM streaks ORDER BY date DESC LIMIT 1
  );

  -- Simple longest streak (max consecutive run)
  WITH completed_dates AS (
    SELECT DISTINCT ds.date
    FROM public.user_progress up
    JOIN public.plan_subscriptions ps ON ps.id = up.subscription_id
    JOIN public.daily_schedules ds ON ds.id = up.schedule_id
    WHERE ps.user_id = v_user_id
      AND up.is_completed = true
    ORDER BY ds.date
  ),
  streaks AS (
    SELECT
      date,
      date - (ROW_NUMBER() OVER (ORDER BY date))::INTEGER AS streak_group
    FROM completed_dates
  )
  SELECT COALESCE(MAX(cnt), 0) INTO v_longest_streak
  FROM (
    SELECT COUNT(*) AS cnt FROM streaks GROUP BY streak_group
  ) s;

  -- Update profile
  UPDATE public.profiles
  SET
    total_completed_days = v_total_days,
    current_streak = v_current_streak,
    longest_streak = GREATEST(v_longest_streak, longest_streak),
    updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_progress_changed
  AFTER INSERT OR UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE PROCEDURE public.update_user_stats();

-- =============================================================================
-- Seed Data
-- =============================================================================

-- Seed: 1 Bible reading plan
INSERT INTO public.bible_reading_plans (id, name, description, is_default, is_active)
VALUES (1, '2026 매일일독 통독표', '2026년 매일일독 성경통독 계획표입니다.', true, true);

-- Seed: 7 daily schedules (Genesis 1-7, one per day for testing)
INSERT INTO public.daily_schedules (id, plan_id, date, book, start_chapter, end_chapter)
VALUES
  (gen_random_uuid(), 1, '2026-01-01', '창세기', 1, 1),
  (gen_random_uuid(), 1, '2026-01-02', '창세기', 2, 2),
  (gen_random_uuid(), 1, '2026-01-03', '창세기', 3, 3),
  (gen_random_uuid(), 1, '2026-01-04', '창세기', 4, 4),
  (gen_random_uuid(), 1, '2026-01-05', '창세기', 5, 5),
  (gen_random_uuid(), 1, '2026-01-06', '창세기', 6, 6),
  (gen_random_uuid(), 1, '2026-01-07', '창세기', 7, 7);
