export interface Profile {
  readonly id: number;
  readonly user: { readonly id: number; readonly username: string; readonly nickname: string; readonly profile_image: string | null };
  readonly bio: string;
  readonly total_completed_days: number;
  readonly current_streak: number;
  readonly longest_streak: number;
  readonly joined_date: string;
  readonly is_public: boolean;
  readonly followers_count: number;
  readonly following_count: number;
  readonly is_following: boolean;
  readonly is_mutual_follow: boolean;
}
export interface CalendarEntry {
  readonly date: string;
  readonly is_completed: boolean;
  readonly book: string;
  readonly chapters: string;
  readonly start_chapter: number;
  readonly end_chapter: number;
  readonly plan_id: number;
  readonly plan_name: string;
  readonly color: string;
  readonly schedule_id: number;
  readonly schedule_text: string;
}
export interface CalendarData {
  readonly calendar: readonly CalendarEntry[];
  readonly plans: readonly { readonly id: number; readonly name: string; readonly color: string }[];
}
export interface Achievement {
  readonly id: number | null;
  readonly achievement_type: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly order: number;
  readonly unlocked: boolean;
  readonly unlockedAt: string | null;
  readonly milestone_value: number;
}
export interface ProfileGroup {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly plans: readonly { readonly id: number; readonly name: string }[];
  readonly is_public: boolean;
  readonly member_count: number;
  readonly max_members: number;
  readonly my_role: string | null;
  readonly show_in_profile: boolean;
}
export interface ProfilePerson {
  readonly id: number;
  readonly username: string;
  readonly nickname: string;
  readonly profile_image: string | null;
  readonly is_following: boolean;
  readonly total_completed_days: number;
}
export interface ProfileDraft { readonly bio: string; readonly is_public: boolean }
export type Resource<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly data: T };
export type ProfileTab = 'calendar' | 'achievements' | 'groups';
export interface ReadyProfile {
  readonly kind: 'ready';
  readonly profile: Profile;
  readonly viewerId: number | null;
  readonly isOwnProfile: boolean;
  readonly avatarFailed: boolean;
  readonly tab: ProfileTab;
  readonly month: string;
  readonly calendar: Resource<CalendarData>;
  readonly achievements: Resource<readonly Achievement[]> | null;
  readonly groups: Resource<readonly ProfileGroup[]> | null;
  readonly selectedDate: string | null;
  readonly achievementTab: 'bible' | 'hasena';
  readonly showHiddenGroups: boolean;
  readonly editor: (ProfileDraft & { readonly saving: boolean; readonly error: string | null }) | null;
  readonly people: { readonly kind: 'followers' | 'following'; readonly result: Resource<readonly ProfilePerson[]> } | null;
  readonly pendingGroup: number | null;
  readonly pendingPerson: number | null;
  readonly actionError: string | null;
}
export type ProfileState =
  | { readonly kind: 'guest' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'unauthorized' | 'forbidden' | 'unavailable' }
  | { readonly kind: 'error'; readonly message: string }
  | ReadyProfile;
