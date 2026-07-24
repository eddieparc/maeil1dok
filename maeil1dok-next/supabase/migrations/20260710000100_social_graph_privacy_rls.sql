-- Tighten social-graph visibility to profile privacy.
-- Follow rows are visible to either side of the relationship, or to other viewers only
-- when both profiles are public.

DROP POLICY IF EXISTS "Anyone can view follows" ON public.user_follows;
DROP POLICY IF EXISTS "Visible follows respect profile visibility" ON public.user_follows;

CREATE POLICY "Visible follows respect profile visibility"
  ON public.user_follows
  FOR SELECT
  USING (
    auth.uid() = follower_id
    OR auth.uid() = following_id
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles follower_profile
        WHERE follower_profile.user_id = user_follows.follower_id
          AND follower_profile.is_public = true
      )
      AND EXISTS (
        SELECT 1
        FROM public.profiles following_profile
        WHERE following_profile.user_id = user_follows.following_id
          AND following_profile.is_public = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can view own or public profiles" ON public.profiles;

CREATE POLICY "Users can view own or public profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);
