-- Restrict authenticated daily_schedules SELECT to schedules whose plan the
-- caller actively subscribes to and whose plan is active. Defense-in-depth for
-- GET /api/bible/schedules, matching Django's _readable_schedule_queryset.

DROP POLICY IF EXISTS "Authenticated users can view schedules" ON public.daily_schedules;

CREATE POLICY "Users can view subscribed active schedules"
  ON public.daily_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.plan_subscriptions ps
      JOIN public.bible_reading_plans brp ON brp.id = ps.plan_id
      WHERE ps.plan_id = daily_schedules.plan_id
        AND ps.user_id = auth.uid()
        AND ps.is_active = true
        AND brp.is_active = true
    )
  );
