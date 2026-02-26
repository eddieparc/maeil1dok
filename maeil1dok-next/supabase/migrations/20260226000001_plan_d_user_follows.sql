-- Plan D: User Follows Table
-- Tracks follower/following relationships between users

CREATE TABLE public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_user_follows_follower_created ON public.user_follows(follower_id, created_at DESC);
CREATE INDEX idx_user_follows_following_created ON public.user_follows(following_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view all follows (public data)
CREATE POLICY "Anyone can view follows" ON public.user_follows FOR SELECT USING (true);

-- Users can insert only their own follows
CREATE POLICY "Users can insert own follows" ON public.user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can delete only their own follows
CREATE POLICY "Users can delete own follows" ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);
