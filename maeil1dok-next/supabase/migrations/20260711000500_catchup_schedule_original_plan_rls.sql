-- Bind catchup_schedules RLS to the session's plan. The legacy policies only
-- checked ownership through session -> subscription -> user, so a direct
-- Supabase client could attach an owned catchup session to an
-- original_schedule_id from a *different* plan. This migration recreates
-- explicit per-command policies that additionally require any referenced
-- original schedule to belong to the same plan as the session's subscription.
-- Nullable original_schedule_id remains allowed because the schema permits it.

DROP POLICY IF EXISTS "Users can view own catchup schedules" ON public.catchup_schedules;
DROP POLICY IF EXISTS "Users can manage own catchup schedules" ON public.catchup_schedules;

CREATE POLICY "Users can view own catchup schedules"
  ON public.catchup_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.catchup_sessions cs
      JOIN public.plan_subscriptions ps ON ps.id = cs.subscription_id
      WHERE cs.id = catchup_schedules.session_id
        AND ps.user_id = auth.uid()
        AND (
          catchup_schedules.original_schedule_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.daily_schedules ds
            WHERE ds.id = catchup_schedules.original_schedule_id
              AND ds.plan_id = ps.plan_id
          )
        )
    )
  );

CREATE POLICY "Users can insert own catchup schedules"
  ON public.catchup_schedules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.catchup_sessions cs
      JOIN public.plan_subscriptions ps ON ps.id = cs.subscription_id
      WHERE cs.id = catchup_schedules.session_id
        AND ps.user_id = auth.uid()
        AND (
          catchup_schedules.original_schedule_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.daily_schedules ds
            WHERE ds.id = catchup_schedules.original_schedule_id
              AND ds.plan_id = ps.plan_id
          )
        )
    )
  );

CREATE POLICY "Users can update own catchup schedules"
  ON public.catchup_schedules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.catchup_sessions cs
      JOIN public.plan_subscriptions ps ON ps.id = cs.subscription_id
      WHERE cs.id = catchup_schedules.session_id
        AND ps.user_id = auth.uid()
        AND (
          catchup_schedules.original_schedule_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.daily_schedules ds
            WHERE ds.id = catchup_schedules.original_schedule_id
              AND ds.plan_id = ps.plan_id
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.catchup_sessions cs
      JOIN public.plan_subscriptions ps ON ps.id = cs.subscription_id
      WHERE cs.id = catchup_schedules.session_id
        AND ps.user_id = auth.uid()
        AND (
          catchup_schedules.original_schedule_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.daily_schedules ds
            WHERE ds.id = catchup_schedules.original_schedule_id
              AND ds.plan_id = ps.plan_id
          )
        )
    )
  );

CREATE POLICY "Users can delete own catchup schedules"
  ON public.catchup_schedules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.catchup_sessions cs
      JOIN public.plan_subscriptions ps ON ps.id = cs.subscription_id
      WHERE cs.id = catchup_schedules.session_id
        AND ps.user_id = auth.uid()
        AND (
          catchup_schedules.original_schedule_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.daily_schedules ds
            WHERE ds.id = catchup_schedules.original_schedule_id
              AND ds.plan_id = ps.plan_id
          )
        )
    )
  );
