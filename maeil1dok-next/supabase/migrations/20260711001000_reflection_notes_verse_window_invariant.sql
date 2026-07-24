LOCK TABLE public.reflection_notes IN ACCESS EXCLUSIVE MODE;

-- Normalize legacy positive one-sided verse windows into canonical single-verse rows.
UPDATE public.reflection_notes
SET end_verse = start_verse
WHERE start_verse > 0
  AND end_verse IS NULL;

UPDATE public.reflection_notes
SET start_verse = end_verse
WHERE end_verse > 0
  AND start_verse IS NULL;

-- Fail closed if any remaining rows cannot satisfy the canonical verse-window check.
DO $$
DECLARE
  invalid_row_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO invalid_row_count
  FROM public.reflection_notes
  WHERE chapter <= 0
     OR (start_verse IS NULL) <> (end_verse IS NULL)
     OR start_verse <= 0
     OR end_verse <= 0
     OR end_verse < start_verse;

  IF invalid_row_count > 0 THEN
    RAISE EXCEPTION '%', invalid_row_count;
  END IF;
END;
$$;

ALTER TABLE public.reflection_notes
  ADD CONSTRAINT reflection_notes_verse_window_check
  CHECK (
    chapter > 0
    AND (
      (
        start_verse IS NULL
        AND end_verse IS NULL
      )
      OR (
        start_verse IS NOT NULL
        AND end_verse IS NOT NULL
        AND start_verse > 0
        AND end_verse > 0
        AND end_verse >= start_verse
      )
    )
  );
