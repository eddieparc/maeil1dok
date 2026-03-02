'use client'

import { useEffect, useState } from 'react'

interface Plan {
  id: number
  title: string
  description?: string
  total_days?: number
}

interface PlanSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPlan: (planId: number) => void
  currentPlanId?: number | null
}

export default function PlanSelectorModal({ isOpen, onClose, onSelectPlan, currentPlanId }: PlanSelectorModalProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    fetch('/api/bible/schedules')
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: { data?: Plan[] }) => setPlans(json.data ?? []))
      .catch(() => setPlans([]))
      .finally(() => setIsLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-8 pt-4">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">플랜 선택</h3>
          <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="닫기">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : plans.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">사용 가능한 플랜이 없어요</div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  currentPlanId === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:bg-gray-50'
                }`}
                onClick={() => { onSelectPlan(plan.id); onClose() }}
              >
                <div>
                  <p className={`font-medium ${currentPlanId === plan.id ? 'text-blue-700' : 'text-gray-900'}`}>{plan.title}</p>
                  {plan.description ? <p className="mt-0.5 text-xs text-gray-400">{plan.description}</p> : null}
                  {plan.total_days ? <p className="mt-0.5 text-xs text-gray-400">{plan.total_days}일</p> : null}
                </div>
                {currentPlanId === plan.id ? (
                  <svg className="h-5 w-5 flex-shrink-0 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
