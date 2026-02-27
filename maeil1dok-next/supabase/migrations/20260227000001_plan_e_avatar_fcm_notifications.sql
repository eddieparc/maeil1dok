-- Plan E: Avatar URL, FCM Tokens, and Notification Settings
-- Adds avatar_url to profiles, creates fcm_tokens and notification_settings tables

-- Add avatar_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;

-- Create FCM Tokens table for push notifications
CREATE TABLE public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Index for efficient queries by user
CREATE INDEX idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);

-- Enable Row Level Security on fcm_tokens
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fcm_tokens
-- Users can view only their own FCM tokens
CREATE POLICY "Users can view own fcm_tokens" ON public.fcm_tokens FOR SELECT USING (auth.uid() = user_id);

-- Users can insert only their own FCM tokens
CREATE POLICY "Users can insert own fcm_tokens" ON public.fcm_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update only their own FCM tokens
CREATE POLICY "Users can update own fcm_tokens" ON public.fcm_tokens FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete only their own FCM tokens
CREATE POLICY "Users can delete own fcm_tokens" ON public.fcm_tokens FOR DELETE USING (auth.uid() = user_id);

-- Create Notification Settings table
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_reminder_enabled BOOLEAN DEFAULT true,
  daily_reminder_time TIME DEFAULT '06:00',
  hasena_notification_enabled BOOLEAN DEFAULT true,
  friend_activity_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for efficient queries by user
CREATE INDEX idx_notification_settings_user_id ON public.notification_settings(user_id);

-- Enable Row Level Security on notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_settings
-- Users can view only their own notification settings
CREATE POLICY "Users can view own notification_settings" ON public.notification_settings FOR SELECT USING (auth.uid() = user_id);

-- Users can insert only their own notification settings
CREATE POLICY "Users can insert own notification_settings" ON public.notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update only their own notification settings
CREATE POLICY "Users can update own notification_settings" ON public.notification_settings FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete only their own notification settings
CREATE POLICY "Users can delete own notification_settings" ON public.notification_settings FOR DELETE USING (auth.uid() = user_id);
