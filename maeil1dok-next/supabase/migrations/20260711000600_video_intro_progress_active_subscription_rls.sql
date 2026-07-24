-- Bind video intro progress to the caller's own active subscription on an
-- active plan that owns the referenced intro. Defense-in-depth for direct
-- Supabase access, matching the guards enforced by POST /api/intro/progress.
-- Also correct get_daily_status.intro_completed so historical progress on
-- inactive or unsubscribed plans no longer grants daily-status credit.

DROP POLICY IF EXISTS "Users can manage own video progress" ON public.user_video_intro_progress;

CREATE POLICY "Users can view own active video progress"
  ON public.user_video_intro_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.video_bible_intros vbi
      JOIN public.bible_reading_plans brp ON brp.id = vbi.plan_id
      JOIN public.plan_subscriptions ps ON ps.plan_id = vbi.plan_id
      WHERE user_video_intro_progress.user_id = auth.uid()
        AND vbi.id = user_video_intro_progress.video_intro_id
        AND ps.user_id = auth.uid()
        AND ps.plan_id = vbi.plan_id
        AND ps.is_active = true
        AND brp.id = vbi.plan_id
        AND brp.is_active = true
    )
  );

CREATE POLICY "Users can insert own active video progress"
  ON public.user_video_intro_progress
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.video_bible_intros vbi
      JOIN public.bible_reading_plans brp ON brp.id = vbi.plan_id
      JOIN public.plan_subscriptions ps ON ps.plan_id = vbi.plan_id
      WHERE user_video_intro_progress.user_id = auth.uid()
        AND vbi.id = user_video_intro_progress.video_intro_id
        AND ps.user_id = auth.uid()
        AND ps.plan_id = vbi.plan_id
        AND ps.is_active = true
        AND brp.id = vbi.plan_id
        AND brp.is_active = true
    )
  );

CREATE POLICY "Users can update own active video progress"
  ON public.user_video_intro_progress
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.video_bible_intros vbi
      JOIN public.bible_reading_plans brp ON brp.id = vbi.plan_id
      JOIN public.plan_subscriptions ps ON ps.plan_id = vbi.plan_id
      WHERE user_video_intro_progress.user_id = auth.uid()
        AND vbi.id = user_video_intro_progress.video_intro_id
        AND ps.user_id = auth.uid()
        AND ps.plan_id = vbi.plan_id
        AND ps.is_active = true
        AND brp.id = vbi.plan_id
        AND brp.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.video_bible_intros vbi
      JOIN public.bible_reading_plans brp ON brp.id = vbi.plan_id
      JOIN public.plan_subscriptions ps ON ps.plan_id = vbi.plan_id
      WHERE user_video_intro_progress.user_id = auth.uid()
        AND vbi.id = user_video_intro_progress.video_intro_id
        AND ps.user_id = auth.uid()
        AND ps.plan_id = vbi.plan_id
        AND ps.is_active = true
        AND brp.id = vbi.plan_id
        AND brp.is_active = true
    )
  );

CREATE POLICY "Users can delete own active video progress"
  ON public.user_video_intro_progress
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.video_bible_intros vbi
      JOIN public.bible_reading_plans brp ON brp.id = vbi.plan_id
      JOIN public.plan_subscriptions ps ON ps.plan_id = vbi.plan_id
      WHERE user_video_intro_progress.user_id = auth.uid()
        AND vbi.id = user_video_intro_progress.video_intro_id
        AND ps.user_id = auth.uid()
        AND ps.plan_id = vbi.plan_id
        AND ps.is_active = true
        AND brp.id = vbi.plan_id
        AND brp.is_active = true
    )
  );

-- Replace get_daily_status so intro_completed only credits progress on an
-- active plan the user actively subscribes to. All other columns and logic
-- are preserved from 20260226000003_plan_d_daily_status_rpc.sql.
CREATE OR REPLACE FUNCTION public.get_daily_status(
  p_user_id UUID,
  p_date DATE
)
RETURNS TABLE (
  reading_completed BOOLEAN,
  hasena_completed BOOLEAN,
  intro_completed BOOLEAN,
  current_streak INT,
  total_completed_days INT,
  longest_streak INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Check if user completed any reading for today
    COALESCE(
      EXISTS(
        SELECT 1 FROM public.user_progress up
        JOIN public.plan_subscriptions ps ON up.subscription_id = ps.id
        JOIN public.daily_schedules ds ON up.schedule_id = ds.id
        WHERE ps.user_id = p_user_id
          AND ds.date = p_date
          AND up.is_completed = true
      ),
      false
    ) AS reading_completed,

    -- Check if user completed hasena for today
    COALESCE(
      EXISTS(
        SELECT 1 FROM public.hasena_records
        WHERE user_id = p_user_id
          AND date = p_date
          AND is_completed = true
      ),
      false
    ) AS hasena_completed,

    -- Check if user completed an intro video for an actively subscribed active plan
    COALESCE(
      EXISTS(
        SELECT 1 FROM public.user_video_intro_progress uvip
        JOIN public.video_bible_intros vbi ON uvip.video_intro_id = vbi.id
        JOIN public.plan_subscriptions ps ON ps.plan_id = vbi.plan_id
        JOIN public.bible_reading_plans brp ON brp.id = vbi.plan_id
        WHERE uvip.user_id = p_user_id
          AND uvip.is_completed = true
          AND vbi.start_date <= p_date
          AND vbi.end_date >= p_date
          AND ps.user_id = p_user_id
          AND ps.plan_id = vbi.plan_id
          AND ps.is_active = true
          AND brp.id = vbi.plan_id
          AND brp.is_active = true
      ),
      false
    ) AS intro_completed,

    -- Get current streak from profiles
    COALESCE(
      (SELECT current_streak FROM public.profiles WHERE user_id = p_user_id),
      0
    ) AS current_streak,

    -- Get total completed days from profiles
    COALESCE(
      (SELECT total_completed_days FROM public.profiles WHERE user_id = p_user_id),
      0
    ) AS total_completed_days,

    -- Get longest streak from profiles
    COALESCE(
      (SELECT longest_streak FROM public.profiles WHERE user_id = p_user_id),
      0
    ) AS longest_streak;
END;
$$ LANGUAGE plpgsql STABLE;

-- Preserve execute permission for authenticated users
GRANT EXECUTE ON FUNCTION public.get_daily_status(UUID, DATE) TO authenticated;
