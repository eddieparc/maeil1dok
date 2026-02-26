-- Plan D: Daily Status RPC Function
-- Returns user's daily reading completion status and streak information

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
    
    -- Check if user completed any intro video for today
    COALESCE(
      EXISTS(
        SELECT 1 FROM public.user_video_intro_progress uvip
        JOIN public.video_bible_intros vbi ON uvip.video_intro_id = vbi.id
        WHERE uvip.user_id = p_user_id
          AND vbi.start_date <= p_date
          AND vbi.end_date >= p_date
          AND uvip.is_completed = true
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_daily_status(UUID, DATE) TO authenticated;
