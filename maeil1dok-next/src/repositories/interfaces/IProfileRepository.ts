import type { UserProfile, UserReadingSettings, UserReadingPosition } from '@/types'

export interface IProfileRepository {
  getProfile(userId?: string): Promise<UserProfile>
  updateProfile(data: Partial<Pick<UserProfile, 'nickname' | 'bio' | 'isPublic'>>): Promise<UserProfile>
  updatePublicStatus(isPublic: boolean): Promise<void>
  getPublicProfiles(limit?: number): Promise<UserProfile[]>
  getReadingSettings(): Promise<UserReadingSettings>
  updateReadingSettings(data: Partial<Omit<UserReadingSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<UserReadingSettings>
  getReadingPosition(): Promise<UserReadingPosition | null>
  updateReadingPosition(data: Partial<Omit<UserReadingPosition, 'id' | 'userId' | 'updatedAt'>>): Promise<UserReadingPosition>
}
