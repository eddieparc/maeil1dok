LOCK TABLE public.user_progress IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  duplicate_group_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_group_count
  FROM (
    SELECT subscription_id, schedule_id
    FROM public.user_progress
    GROUP BY subscription_id, schedule_id
    HAVING COUNT(*) > 1
  ) AS duplicate_progress_pairs;

  IF duplicate_group_count > 0 THEN
    RAISE EXCEPTION '%', duplicate_group_count;
  END IF;
END;
$$;

ALTER TABLE public.user_progress
  ADD CONSTRAINT user_progress_subscription_schedule_key
  UNIQUE (subscription_id, schedule_id);
