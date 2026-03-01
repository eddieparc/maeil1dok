-- Plan F: Bible Bookmarks, Reflection Notes, Personal Reading Records, and Migration User Mapping
-- Stores user's Bible bookmarks, reflection notes, personal reading records, and Django-to-Supabase user mapping

-- ============================================================================
-- bible_bookmarks table
-- ============================================================================
CREATE TABLE public.bible_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_type TEXT NOT NULL CHECK (bookmark_type IN ('chapter', 'verse')),
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  start_verse INTEGER,
  end_verse INTEGER,
  title TEXT NOT NULL DEFAULT '',
  color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique indexes for chapter and verse bookmarks
CREATE UNIQUE INDEX unique_chapter_bookmark ON public.bible_bookmarks(user_id, book, chapter) WHERE bookmark_type='chapter';
CREATE UNIQUE INDEX unique_verse_bookmark ON public.bible_bookmarks(user_id, book, chapter, start_verse, end_verse) WHERE bookmark_type='verse';

-- Composite indexes for efficient queries
CREATE INDEX idx_bible_bookmarks_user_book_chapter ON public.bible_bookmarks(user_id, book, chapter);
CREATE INDEX idx_bible_bookmarks_user_type ON public.bible_bookmarks(user_id, bookmark_type);

-- Enable Row Level Security
ALTER TABLE public.bible_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bible_bookmarks
CREATE POLICY "Users can view own bookmarks" ON public.bible_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON public.bible_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookmarks" ON public.bible_bookmarks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bible_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- reflection_notes table
-- ============================================================================
CREATE TABLE public.reflection_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  start_verse INTEGER,
  end_verse INTEGER,
  content TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite indexes for efficient queries
CREATE INDEX idx_reflection_notes_user_book_chapter ON public.reflection_notes(user_id, book, chapter);
CREATE INDEX idx_reflection_notes_user_created_at ON public.reflection_notes(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.reflection_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reflection_notes
CREATE POLICY "Users can view own reflection notes" ON public.reflection_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reflection notes" ON public.reflection_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reflection notes" ON public.reflection_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reflection notes" ON public.reflection_notes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- personal_reading_records table
-- ============================================================================
CREATE TABLE public.personal_reading_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  read_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book, chapter)
);

-- Composite indexes for efficient queries
CREATE INDEX idx_personal_reading_records_user_book ON public.personal_reading_records(user_id, book);
CREATE INDEX idx_personal_reading_records_user_read_date ON public.personal_reading_records(user_id, read_date);

-- Enable Row Level Security
ALTER TABLE public.personal_reading_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for personal_reading_records
CREATE POLICY "Users can view own personal reading records" ON public.personal_reading_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own personal reading records" ON public.personal_reading_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own personal reading records" ON public.personal_reading_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own personal reading records" ON public.personal_reading_records FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- migration_user_mapping table
-- ============================================================================
-- TEMPORARY: Drop this table after migration verification is complete
CREATE TABLE public.migration_user_mapping (
  id SERIAL PRIMARY KEY,
  django_user_id INTEGER NOT NULL UNIQUE,
  supabase_user_id UUID NOT NULL UNIQUE,
  django_email TEXT NOT NULL,
  django_social_provider TEXT,
  django_social_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS policies on migration_user_mapping - service_role key will be used for all access
