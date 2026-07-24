import type { BibleReadingPlan, PlanSubscription, PlanDisplaySettings } from '@/types'

export interface IPlanRepository {
  getAvailablePlans(): Promise<BibleReadingPlan[]>
  getPlanById(planId: number): Promise<BibleReadingPlan>
  subscribeToPlan(planId: number, startDate: string): Promise<PlanSubscription>
  unsubscribeFromPlan(subscriptionId: string): Promise<void>
  getUserSubscriptions(): Promise<PlanSubscription[]>
  getSubscriptionById(id: string): Promise<PlanSubscription | null>
  getDisplaySettings(subscriptionId: string): Promise<PlanDisplaySettings | null>
  getDisplaySettingsForSubscriptions(subscriptionIds: string[]): Promise<PlanDisplaySettings[]>
  updateDisplaySettings(subscriptionId: string, data: Partial<Pick<PlanDisplaySettings, 'color' | 'displayOrder' | 'isVisible'>>): Promise<PlanDisplaySettings>
}
