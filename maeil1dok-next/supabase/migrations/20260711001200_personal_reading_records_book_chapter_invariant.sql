LOCK TABLE public.personal_reading_records IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  invalid_row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_row_count
  FROM public.personal_reading_records
  WHERE chapter <= 0
     OR chapter > CASE book
       WHEN 'gen' THEN 50
       WHEN 'exo' THEN 40
       WHEN 'lev' THEN 27
       WHEN 'num' THEN 36
       WHEN 'deu' THEN 34
       WHEN 'jos' THEN 24
       WHEN 'jdg' THEN 21
       WHEN 'rut' THEN 4
       WHEN '1sa' THEN 31
       WHEN '2sa' THEN 24
       WHEN '1ki' THEN 22
       WHEN '2ki' THEN 25
       WHEN '1ch' THEN 29
       WHEN '2ch' THEN 36
       WHEN 'ezr' THEN 10
       WHEN 'neh' THEN 13
       WHEN 'est' THEN 10
       WHEN 'job' THEN 42
       WHEN 'psa' THEN 150
       WHEN 'pro' THEN 31
       WHEN 'ecc' THEN 12
       WHEN 'sng' THEN 8
       WHEN 'isa' THEN 66
       WHEN 'jer' THEN 52
       WHEN 'lam' THEN 5
       WHEN 'ezk' THEN 48
       WHEN 'dan' THEN 12
       WHEN 'hos' THEN 14
       WHEN 'jol' THEN 3
       WHEN 'amo' THEN 9
       WHEN 'oba' THEN 1
       WHEN 'jon' THEN 4
       WHEN 'mic' THEN 7
       WHEN 'nam' THEN 3
       WHEN 'hab' THEN 3
       WHEN 'zep' THEN 3
       WHEN 'hag' THEN 2
       WHEN 'zec' THEN 14
       WHEN 'mal' THEN 4
       WHEN 'mat' THEN 28
       WHEN 'mrk' THEN 16
       WHEN 'luk' THEN 24
       WHEN 'jhn' THEN 21
       WHEN 'act' THEN 28
       WHEN 'rom' THEN 16
       WHEN '1co' THEN 16
       WHEN '2co' THEN 13
       WHEN 'gal' THEN 6
       WHEN 'eph' THEN 6
       WHEN 'php' THEN 4
       WHEN 'col' THEN 4
       WHEN '1th' THEN 5
       WHEN '2th' THEN 3
       WHEN '1ti' THEN 6
       WHEN '2ti' THEN 4
       WHEN 'tit' THEN 3
       WHEN 'phm' THEN 1
       WHEN 'heb' THEN 13
       WHEN 'jas' THEN 5
       WHEN '1pe' THEN 5
       WHEN '2pe' THEN 3
       WHEN '1jn' THEN 5
       WHEN '2jn' THEN 1
       WHEN '3jn' THEN 1
       WHEN 'jud' THEN 1
       WHEN 'rev' THEN 22
       ELSE 0
     END;

  IF invalid_row_count > 0 THEN
    RAISE EXCEPTION '%', invalid_row_count;
  END IF;
END;
$$;

ALTER TABLE public.personal_reading_records
  ADD CONSTRAINT personal_reading_records_book_chapter_check
  CHECK (
    chapter > 0
    AND chapter <= CASE book
      WHEN 'gen' THEN 50
      WHEN 'exo' THEN 40
      WHEN 'lev' THEN 27
      WHEN 'num' THEN 36
      WHEN 'deu' THEN 34
      WHEN 'jos' THEN 24
      WHEN 'jdg' THEN 21
      WHEN 'rut' THEN 4
      WHEN '1sa' THEN 31
      WHEN '2sa' THEN 24
      WHEN '1ki' THEN 22
      WHEN '2ki' THEN 25
      WHEN '1ch' THEN 29
      WHEN '2ch' THEN 36
      WHEN 'ezr' THEN 10
      WHEN 'neh' THEN 13
      WHEN 'est' THEN 10
      WHEN 'job' THEN 42
      WHEN 'psa' THEN 150
      WHEN 'pro' THEN 31
      WHEN 'ecc' THEN 12
      WHEN 'sng' THEN 8
      WHEN 'isa' THEN 66
      WHEN 'jer' THEN 52
      WHEN 'lam' THEN 5
      WHEN 'ezk' THEN 48
      WHEN 'dan' THEN 12
      WHEN 'hos' THEN 14
      WHEN 'jol' THEN 3
      WHEN 'amo' THEN 9
      WHEN 'oba' THEN 1
      WHEN 'jon' THEN 4
      WHEN 'mic' THEN 7
      WHEN 'nam' THEN 3
      WHEN 'hab' THEN 3
      WHEN 'zep' THEN 3
      WHEN 'hag' THEN 2
      WHEN 'zec' THEN 14
      WHEN 'mal' THEN 4
      WHEN 'mat' THEN 28
      WHEN 'mrk' THEN 16
      WHEN 'luk' THEN 24
      WHEN 'jhn' THEN 21
      WHEN 'act' THEN 28
      WHEN 'rom' THEN 16
      WHEN '1co' THEN 16
      WHEN '2co' THEN 13
      WHEN 'gal' THEN 6
      WHEN 'eph' THEN 6
      WHEN 'php' THEN 4
      WHEN 'col' THEN 4
      WHEN '1th' THEN 5
      WHEN '2th' THEN 3
      WHEN '1ti' THEN 6
      WHEN '2ti' THEN 4
      WHEN 'tit' THEN 3
      WHEN 'phm' THEN 1
      WHEN 'heb' THEN 13
      WHEN 'jas' THEN 5
      WHEN '1pe' THEN 5
      WHEN '2pe' THEN 3
      WHEN '1jn' THEN 5
      WHEN '2jn' THEN 1
      WHEN '3jn' THEN 1
      WHEN 'jud' THEN 1
      WHEN 'rev' THEN 22
      ELSE 0
    END
  );
