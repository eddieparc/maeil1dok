import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import ReadingProgressButton from './ReadingProgressButton'

function ReadingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {children}
    </div>
  )
}

export default async function ReadingPage() {
  try {
    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)

    const [schedule, subscriptions] = await Promise.all([
      repositories.schedule.getCurrentSchedule(),
      repositories.plan.getUserSubscriptions(),
    ])

    if (!schedule) {
      return (
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
          <ReadingCard>
            <p className="text-center text-base text-gray-700">오늘의 통독 일정이 없습니다</p>
          </ReadingCard>
        </div>
      )
    }

    const activeSubscription = subscriptions.find((subscription) => subscription.isActive) ?? null

    if (!activeSubscription) {
      return (
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
          <ReadingCard>
            <h1 className="text-xl font-semibold text-gray-900">오늘의 통독</h1>
            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <p>본문: {schedule.book}</p>
              <p>
                장: {schedule.startChapter} - {schedule.endChapter}
              </p>
              <p>날짜: {schedule.date}</p>
            </div>
            <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              통독 계획을 구독해주세요
            </p>
          </ReadingCard>
        </div>
      )
    }

    const progress = await repositories.progress.getProgress(activeSubscription.id, schedule.id)
    const initialCompleted = progress?.isCompleted ?? false

    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <ReadingCard>
          <h1 className="text-xl font-semibold text-gray-900">오늘의 통독</h1>
          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <p>본문: {schedule.book}</p>
            <p>
              장: {schedule.startChapter} - {schedule.endChapter}
            </p>
            <p>날짜: {schedule.date}</p>
          </div>
          <div className="mt-6">
            <ReadingProgressButton
              scheduleId={schedule.id}
              subscriptionId={activeSubscription.id}
              initialCompleted={initialCompleted}
            />
          </div>
        </ReadingCard>
      </div>
    )
  } catch {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <ReadingCard>
          <p className="text-center text-sm text-red-600">일정을 불러오는 중 오류가 발생했습니다</p>
        </ReadingCard>
      </div>
    )
  }
}
