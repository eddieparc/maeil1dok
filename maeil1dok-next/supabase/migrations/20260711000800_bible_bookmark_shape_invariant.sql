LOCK TABLE public.bible_bookmarks IN ACCESS EXCLUSIVE MODE;

-- Normalize legacy chapter bookmarks that carried stray verse bounds.
UPDATE public.bible_bookmarks
SET start_verse = NULL,
    end_verse = NULL
WHERE bookmark_type = 'chapter'
  AND (start_verse IS NOT NULL OR end_verse IS NOT NULL);

-- Fail closed if any remaining rows cannot satisfy the canonical shape check.
DO $$
DECLARE
  invalid_row_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO invalid_row_count
  FROM public.bible_bookmarks
  WHERE chapter <= 0
     OR (
       bookmark_type = 'verse'
       AND (
         start_verse IS NULL
         OR end_verse IS NULL
         OR start_verse <= 0
         OR end_verse <= 0
         OR end_verse < start_verse
       )
     );

  IF invalid_row_count > 0 THEN
    RAISE EXCEPTION '%', invalid_row_count;
  END IF;
END;
$$;

ALTER TABLE public.bible_bookmarks
  ADD CONSTRAINT bible_bookmarks_shape_check
  CHECK (
    chapter > 0
    AND (
      (
        bookmark_type = 'chapter'
        AND start_verse IS NULL
        AND end_verse IS NULL
      )
      OR (
        bookmark_type = 'verse'
        AND start_verse IS NOT NULL
        AND end_verse IS NOT NULL
        AND start_verse > 0
        AND end_verse > 0
        AND end_verse >= start_verse
      )
    )
  );
