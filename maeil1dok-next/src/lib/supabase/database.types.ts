export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          nickname: string
          bio: string
          total_completed_days: number
          current_streak: number
          longest_streak: number
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          nickname: string
          bio?: string
          total_completed_days?: number
          current_streak?: number
          longest_streak?: number
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          nickname?: string
          bio?: string
          total_completed_days?: number
          current_streak?: number
          longest_streak?: number
          is_public?: boolean
          updated_at?: string
        }
      }
      bible_reading_plans: {
        Row: {
          id: number
          name: string
          description: string
          is_default: boolean
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          description?: string
          is_default?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string
          is_default?: boolean
          is_active?: boolean
          created_by?: string | null
          updated_at?: string
        }
      }
      plan_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: number
          start_date: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: number
          start_date: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          updated_at?: string
        }
      }
      daily_schedules: {
        Row: {
          id: string
          plan_id: number
          date: string
          book: string
          start_chapter: number
          end_chapter: number
          audio_link: string | null
          guide_link: string | null
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: number
          date: string
          book: string
          start_chapter: number
          end_chapter: number
          audio_link?: string | null
          guide_link?: string | null
          created_at?: string
        }
        Update: {
          book?: string
          start_chapter?: number
          end_chapter?: number
          audio_link?: string | null
          guide_link?: string | null
        }
      }
      user_progress: {
        Row: {
          id: string
          subscription_id: string
          schedule_id: string
          is_completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          schedule_id: string
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_completed?: boolean
          completed_at?: string | null
          updated_at?: string
        }
      }
      user_plan_display_settings: {
        Row: {
          id: string
          user_id: string
          subscription_id: string
          color: string
          display_order: number
          is_visible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id: string
          color?: string
          display_order?: number
          is_visible?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          color?: string
          display_order?: number
          is_visible?: boolean
          updated_at?: string
        }
      }
      user_reading_settings: {
        Row: {
          id: string
          user_id: string
          theme: string
          font_family: string
          font_size: number
          font_weight: string
          line_height: number
          text_align: string
          verse_joining: boolean
          show_verse_numbers: boolean
          show_description: boolean
          show_cross_ref: boolean
          highlight_names: boolean
          show_footnotes: boolean
          tongdok_auto_complete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme?: string
          font_family?: string
          font_size?: number
          font_weight?: string
          line_height?: number
          text_align?: string
          verse_joining?: boolean
          show_verse_numbers?: boolean
          show_description?: boolean
          show_cross_ref?: boolean
          highlight_names?: boolean
          show_footnotes?: boolean
          tongdok_auto_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          theme?: string
          font_family?: string
          font_size?: number
          font_weight?: string
          line_height?: number
          text_align?: string
          verse_joining?: boolean
          show_verse_numbers?: boolean
          show_description?: boolean
          show_cross_ref?: boolean
          highlight_names?: boolean
          show_footnotes?: boolean
          tongdok_auto_complete?: boolean
          updated_at?: string
        }
      }
      user_reading_positions: {
        Row: {
          id: string
          user_id: string
          book: string
          chapter: number
          verse: number | null
          scroll_position: number
          version: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book: string
          chapter: number
          verse?: number | null
          scroll_position?: number
          version?: string
          updated_at?: string
        }
        Update: {
          book?: string
          chapter?: number
          verse?: number | null
          scroll_position?: number
          version?: string
          updated_at?: string
        }
      }
      video_bible_intros: {
        Row: {
          id: string
          plan_id: number
          book: string
          url_link: string
          start_date: string
          end_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: number
          book: string
          url_link: string
          start_date: string
          end_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          url_link?: string
          start_date?: string
          end_date?: string
          updated_at?: string
        }
      }
      user_video_intro_progress: {
        Row: {
          id: string
          user_id: string
          video_intro_id: string
          is_completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_intro_id: string
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_completed?: boolean
          completed_at?: string | null
          updated_at?: string
        }
      }
      hasena_records: {
        Row: {
          id: string
          user_id: string
          date: string
          is_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_completed?: boolean
          updated_at?: string
        }
      }
      hasena_summaries: {
        Row: {
          id: string
          video_id: string
          video_date: string | null
          title: string
          summary: string
          transcript: string
          model_used: string
          is_edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          video_id: string
          video_date?: string | null
          title?: string
          summary: string
          transcript?: string
          model_used?: string
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          video_date?: string | null
          title?: string
          summary?: string
          transcript?: string
          model_used?: string
          is_edited?: boolean
          updated_at?: string
        }
      }
      catchup_sessions: {
        Row: {
          id: string
          subscription_id: string
          name: string
          range_start: string
          range_end: string
          strategy: string
          target_rejoin_date: string | null
          max_daily_readings: number | null
          max_daily_chapters: number | null
          weekend_multiplier: number
          status: string
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          name: string
          range_start: string
          range_end: string
          strategy?: string
          target_rejoin_date?: string | null
          max_daily_readings?: number | null
          max_daily_chapters?: number | null
          weekend_multiplier?: number
          status?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          strategy?: string
          target_rejoin_date?: string | null
          max_daily_readings?: number | null
          max_daily_chapters?: number | null
          weekend_multiplier?: number
          status?: string
          completed_at?: string | null
          updated_at?: string
        }
      }
      catchup_schedules: {
        Row: {
          id: string
          session_id: string
          original_schedule_id: string | null
          scheduled_date: string
          is_completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          original_schedule_id?: string | null
          scheduled_date: string
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          scheduled_date?: string
          is_completed?: boolean
          completed_at?: string | null
          updated_at?: string
        }
      }
      bible_content_cache: {
        Row: {
          id: string
          book: string
          chapter: number
          language: string
          version: string
          content: Json
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          book: string
          chapter: number
          language?: string
          version?: string
          content: Json
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          source?: string | null
          updated_at?: string
        }
      }
      user_follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }
      user_highlights: {
        Row: {
          id: string
          user_id: string
          book: string
          chapter: number
          verse_start: number
          verse_end: number
          color: string
          version: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book: string
          chapter: number
          verse_start: number
          verse_end: number
          color?: string
          version?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          book?: string
          chapter?: number
          verse_start?: number
          verse_end?: number
          color?: string
          version?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_daily_status: {
        Args: { p_user_id: string; p_date: string }
        Returns: {
          reading_completed: boolean
          hasena_completed: boolean
          intro_completed: boolean
          current_streak: number
          total_completed_days: number
          longest_streak: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
