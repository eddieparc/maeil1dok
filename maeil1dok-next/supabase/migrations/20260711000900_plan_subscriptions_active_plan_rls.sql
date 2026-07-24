-- Block direct Supabase clients from creating or reactivating a
-- plan_subscriptions row that references an inactive or missing
-- bible_reading_plans row. Defense-in-depth matching the active-plan gating
-- enforced by SupabasePlanRepository.subscribeToPlan() and the getAvailablePlans
-- is_active filter. Ownership is still required; deactivating one's own
-- subscription remains allowed even if the plan later became inactive.

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.plan_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.plan_subscriptions;

CREATE POLICY "Users can insert own active-plan subscriptions"
  ON public.plan_subscriptions
  FOR INSERT
  WITH CHECK (
    auth.uid() = plan_subscriptions.user_id
    AND EXISTS (
      SELECT 1
      FROM public.bible_reading_plans brp
      WHERE brp.id = plan_subscriptions.plan_id
        AND brp.is_active = true
    )
  );

CREATE POLICY "Users can update own active-plan subscriptions"
  ON public.plan_subscriptions
  FOR UPDATE
  USING (auth.uid() = plan_subscriptions.user_id)
  WITH CHECK (
    auth.uid() = plan_subscriptions.user_id
    AND (
      -- Always allow the user to deactivate their own subscription, even if
      -- the referenced plan is no longer active.
      plan_subscriptions.is_active = false
      OR EXISTS (
        SELECT 1
        FROM public.bible_reading_plans brp
        WHERE brp.id = plan_subscriptions.plan_id
          AND brp.is_active = true
      )
    )
  );
