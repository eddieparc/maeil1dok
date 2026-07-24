-- Enforce that a user_plan_display_settings row can never pair one user's
-- user_id with another user's plan_subscriptions.id. The trigger
-- handle_new_subscription() already upholds this invariant in application
-- behavior, but a direct Supabase insert/update could previously forge a row
-- where user_id = auth.uid() while subscription_id belongs to a different user.
-- This migration makes the invariant a schema-level guarantee (composite FK)
-- and tightens RLS so both auth.uid() and the referenced subscription owner
-- must match the row's user_id.

-- 1. Repair any pre-existing mismatched rows so the composite FK can be added.
--    Realign user_id to the true owner of the referenced subscription.
UPDATE public.user_plan_display_settings uds
SET user_id = ps.user_id,
    updated_at = NOW()
FROM public.plan_subscriptions ps
WHERE uds.subscription_id = ps.id
  AND uds.user_id <> ps.user_id;

-- 2. Composite unique constraint required for a composite FK target.
--    Redundant with the primary key on id, but PostgreSQL requires a unique
--    constraint that exactly matches the referenced (id, user_id) columns.
ALTER TABLE public.plan_subscriptions
  ADD CONSTRAINT plan_subscriptions_id_user_id_key UNIQUE (id, user_id);

-- 3. Composite FK binding the display-settings owner to the subscription owner.
ALTER TABLE public.user_plan_display_settings
  ADD CONSTRAINT user_plan_display_settings_subscription_owner_fkey
  FOREIGN KEY (subscription_id, user_id)
  REFERENCES public.plan_subscriptions (id, user_id)
  ON DELETE CASCADE;

-- 4. Replace the broad FOR ALL policy with explicit per-command policies that
--    require both auth.uid() = user_id and a matching subscription owner.
DROP POLICY IF EXISTS "Users can manage own display settings" ON public.user_plan_display_settings;

CREATE POLICY "Users can view own display settings"
  ON public.user_plan_display_settings
  FOR SELECT
  USING (
    auth.uid() = user_plan_display_settings.user_id
    AND EXISTS (
      SELECT 1 FROM public.plan_subscriptions ps
      WHERE ps.id = user_plan_display_settings.subscription_id
        AND ps.user_id = user_plan_display_settings.user_id
    )
  );

CREATE POLICY "Users can insert own display settings"
  ON public.user_plan_display_settings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_plan_display_settings.user_id
    AND EXISTS (
      SELECT 1 FROM public.plan_subscriptions ps
      WHERE ps.id = user_plan_display_settings.subscription_id
        AND ps.user_id = user_plan_display_settings.user_id
    )
  );

CREATE POLICY "Users can update own display settings"
  ON public.user_plan_display_settings
  FOR UPDATE
  USING (
    auth.uid() = user_plan_display_settings.user_id
    AND EXISTS (
      SELECT 1 FROM public.plan_subscriptions ps
      WHERE ps.id = user_plan_display_settings.subscription_id
        AND ps.user_id = user_plan_display_settings.user_id
    )
  )
  WITH CHECK (
    auth.uid() = user_plan_display_settings.user_id
    AND EXISTS (
      SELECT 1 FROM public.plan_subscriptions ps
      WHERE ps.id = user_plan_display_settings.subscription_id
        AND ps.user_id = user_plan_display_settings.user_id
    )
  );

CREATE POLICY "Users can delete own display settings"
  ON public.user_plan_display_settings
  FOR DELETE
  USING (
    auth.uid() = user_plan_display_settings.user_id
    AND EXISTS (
      SELECT 1 FROM public.plan_subscriptions ps
      WHERE ps.id = user_plan_display_settings.subscription_id
        AND ps.user_id = user_plan_display_settings.user_id
    )
  );
