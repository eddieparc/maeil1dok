-- Restrict user_progress reads/writes to rows that belong to the caller's own
-- active subscription on an active plan, where the referenced schedule belongs
-- to that same plan. Defense-in-depth for direct Supabase access, matching the
-- guards already enforced by POST /api/bible/schedules/complete.

DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;

CREATE POLICY "Users can view own active progress"
  ON public.user_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.plan_subscriptions ps
      JOIN public.bible_reading_plans brp ON brp.id = ps.plan_id
      JOIN public.daily_schedules ds ON ds.id = user_progress.schedule_id
      WHERE ps.id = user_progress.subscription_id
        AND ps.user_id = auth.uid()
        AND ps.is_active = true
        AND brp.is_active = true
        AND ds.plan_id = ps.plan_id
    )
  );

CREATE POLICY "Users can insert own active progress"
  ON public.user_progress
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.plan_subscriptions ps
      JOIN public.bible_reading_plans brp ON brp.id = ps.plan_id
      JOIN public.daily_schedules ds ON ds.id = user_progress.schedule_id
      WHERE ps.id = user_progress.subscription_id
        AND ps.user_id = auth.uid()
        AND ps.is_active = true
        AND brp.is_active = true
        AND ds.plan_id = ps.plan_id
    )
  );

CREATE POLICY "Users can update own active progress"
  ON public.user_progress
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.plan_subscriptions ps
      JOIN public.bible_reading_plans brp ON brp.id = ps.plan_id
      JOIN public.daily_schedules ds ON ds.id = user_progress.schedule_id
      WHERE ps.id = user_progress.subscription_id
        AND ps.user_id = auth.uid()
        AND ps.is_active = true
        AND brp.is_active = true
        AND ds.plan_id = ps.plan_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.plan_subscriptions ps
      JOIN public.bible_reading_plans brp ON brp.id = ps.plan_id
      JOIN public.daily_schedules ds ON ds.id = user_progress.schedule_id
      WHERE ps.id = user_progress.subscription_id
        AND ps.user_id = auth.uid()
        AND ps.is_active = true
        AND brp.is_active = true
        AND ds.plan_id = ps.plan_id
    )
  );
