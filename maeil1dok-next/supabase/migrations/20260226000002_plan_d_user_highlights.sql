-- Plan D: User Highlights Table
-- Stores user's Bible verse highlights with color and version info

CREATE TABLE public.user_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse_start INTEGER NOT NULL,
  verse_end INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow',
  version TEXT NOT NULL DEFAULT 'GAE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book, chapter, verse_start, verse_end, version)
);

-- Index for efficient queries by user and book/chapter
CREATE INDEX idx_user_highlights_user_book_chapter ON public.user_highlights(user_id, book, chapter, version);

-- Enable Row Level Security
ALTER TABLE public.user_highlights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view only their own highlights
CREATE POLICY "Users can view own highlights" ON public.user_highlights FOR SELECT USING (auth.uid() = user_id);

-- Users can insert only their own highlights
CREATE POLICY "Users can insert own highlights" ON public.user_highlights FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update only their own highlights
CREATE POLICY "Users can update own highlights" ON public.user_highlights FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete only their own highlights
CREATE POLICY "Users can delete own highlights" ON public.user_highlights FOR DELETE USING (auth.uid() = user_id);
