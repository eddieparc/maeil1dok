import type { DailySchedule } from '@/types'

export interface IScheduleRepository {
  getScheduleByDate(date: string): Promise<DailySchedule | null>
  getSchedulesForPlan(planId: number, start: string, end: string): Promise<DailySchedule[]>
  getCurrentSchedule(): Promise<DailySchedule | null>
  getScheduleById(id: string): Promise<DailySchedule | null>
}
