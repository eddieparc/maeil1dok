DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT subscription_id
    FROM public.catchup_sessions
    WHERE status = 'active'
    GROUP BY subscription_id
    HAVING COUNT(*) > 1
  ) AS duplicate_subscriptions;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION '%', duplicate_count;
  END IF;
END;
$$;

CREATE UNIQUE INDEX catchup_sessions_one_active_per_subscription_idx
  ON public.catchup_sessions(subscription_id)
  WHERE status = 'active';
