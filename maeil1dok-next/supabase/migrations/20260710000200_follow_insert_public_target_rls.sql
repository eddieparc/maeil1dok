-- Require follow inserts to target an existing public profile.
DROP POLICY IF EXISTS "Users can insert own follows" ON public.user_follows;

CREATE POLICY "Users can insert own follows"
  ON public.user_follows
  FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles target_profile
      WHERE target_profile.user_id = user_follows.following_id
        AND target_profile.is_public = true
    )
  );
