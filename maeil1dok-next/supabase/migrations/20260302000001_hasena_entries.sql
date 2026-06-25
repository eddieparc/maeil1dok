CREATE TABLE public.hasena_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  passage TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  verses JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_url TEXT NOT NULL DEFAULT '',
  body_source_url TEXT NOT NULL DEFAULT '',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX hasena_entries_date_idx ON public.hasena_entries(date DESC);

ALTER TABLE public.hasena_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hasena entries"
  ON public.hasena_entries FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage hasena entries"
  ON public.hasena_entries FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.update_hasena_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_hasena_entries_updated_at
  BEFORE UPDATE ON public.hasena_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hasena_entries_updated_at();

CREATE OR REPLACE FUNCTION public.upsert_hasena_entry(
  p_date DATE,
  p_video_id TEXT,
  p_title TEXT,
  p_passage TEXT,
  p_body_text TEXT,
  p_verses JSONB,
  p_source_url TEXT,
  p_body_source_url TEXT,
  p_fetched_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.hasena_entries (
    date,
    video_id,
    title,
    passage,
    body_text,
    verses,
    source_url,
    body_source_url,
    fetched_at
  )
  VALUES (
    p_date,
    p_video_id,
    p_title,
    p_passage,
    p_body_text,
    p_verses,
    p_source_url,
    p_body_source_url,
    p_fetched_at
  )
  ON CONFLICT (date) DO UPDATE SET
    video_id = EXCLUDED.video_id,
    title = EXCLUDED.title,
    passage = EXCLUDED.passage,
    body_text = EXCLUDED.body_text,
    verses = EXCLUDED.verses,
    source_url = EXCLUDED.source_url,
    body_source_url = EXCLUDED.body_source_url,
    fetched_at = EXCLUDED.fetched_at,
    updated_at = NOW();
END;
$$;
