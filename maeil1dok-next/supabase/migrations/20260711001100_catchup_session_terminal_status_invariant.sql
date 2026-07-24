LOCK TABLE public.catchup_sessions IN ACCESS EXCLUSIVE MODE;

-- Fail closed if any existing row disagrees between its status and completed_at:
--   * a completed session without a completion timestamp, or
--   * a non-completed (active/abandoned) session that still carries one.
DO $$
DECLARE
  inconsistent_row_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO inconsistent_row_count
  FROM public.catchup_sessions
  WHERE (status = 'completed' AND completed_at IS NULL)
     OR (status <> 'completed' AND completed_at IS NOT NULL);

  IF inconsistent_row_count > 0 THEN
    RAISE EXCEPTION '%', inconsistent_row_count;
  END IF;
END;
$$;

ALTER TABLE public.catchup_sessions
  ADD CONSTRAINT catchup_sessions_status_completed_at_consistency
  CHECK (
    (
      status = 'completed'
      AND completed_at IS NOT NULL
    )
    OR (
      status <> 'completed'
      AND completed_at IS NULL
    )
  );
