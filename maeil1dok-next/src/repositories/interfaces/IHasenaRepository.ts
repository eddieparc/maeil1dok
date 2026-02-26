import type { HasenaRecord, HasenaSummary, VideoBibleIntro, VideoIntroProgress } from '@/types'

export interface IHasenaRepository {
  getRecordByDate(date: string): Promise<HasenaRecord | null>
  markHasenaComplete(date: string): Promise<HasenaRecord>
  markHasenaIncomplete(date: string): Promise<HasenaRecord>
  getRecentRecords(limit?: number): Promise<HasenaRecord[]>
  getSummaryByDate(date: string): Promise<HasenaSummary | null>
  getRecentSummaries(limit?: number): Promise<HasenaSummary[]>
  getVideoIntroByBook(planId: number, book: string): Promise<VideoBibleIntro | null>
  getVideoIntroProgress(videoIntroId: string): Promise<VideoIntroProgress | null>
  markVideoIntroComplete(videoIntroId: string): Promise<VideoIntroProgress>
}
