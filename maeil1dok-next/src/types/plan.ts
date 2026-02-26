export interface PlanSubscription {
  id: string
  userId: string
  planId: number
  startDate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PlanDisplaySettings {
  id: string
  userId: string
  subscriptionId: string
  color: string
  displayOrder: number
  isVisible: boolean
  createdAt: string
  updatedAt: string
}
