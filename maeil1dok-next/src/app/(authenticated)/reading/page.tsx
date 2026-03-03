import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { Container } from '@/components/ui'
import ReadingProgressButton from './ReadingProgressButton'

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/20 p-6 shadow-[0_12px_26px_rgba(0,0,0,0.14)] bg-gradient-to-br from-sky-600 to-indigo-900 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_58%)]" />
      <div className="relative">{children}</div>
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
        <Container fullHeight className="py-8">
          <div className="mx-auto max-w-md">
            <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              ← 홈으로
            </Link>
            <EmptyCard>
              <p className="text-center text-base text-white/90">오늘의 통독 일정이 없습니다</p>
            </EmptyCard>
            <Link href="/plan" className="mt-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              📅 통독표 보기
            </Link>
          </div>
        </Container>
      )
    }

    const activeSubscription = subscriptions.find((subscription) => subscription.isActive) ?? null

    if (!activeSubscription) {
      return (
        <Container fullHeight className="py-8">
          <div className="mx-auto max-w-md">
            <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              ← 홈으로
            </Link>
            <div className="relative w-full overflow-hidden rounded-3xl border border-white/20 p-6 shadow-[0_12px_26px_rgba(0,0,0,0.14)] bg-gradient-to-br from-sky-600 to-indigo-900 text-white">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_58%)]" />
              <div className="relative">
                <span className="text-xs font-semibold tracking-[0.18em] text-white/65 uppercase">TODAY&apos;S READING</span>
                <h2 className="mt-2 text-2xl leading-tight font-light" style={{ fontFamily: 'Georgia, "KoPub Batang", serif' }}>
                  {schedule.book}
                  <br />
                  <strong className="font-bold">
                    {schedule.startChapter}-{schedule.endChapter}장
                  </strong>
                </h2>
                <p className="mt-1 text-sm opacity-75">{schedule.date}</p>
                <p className="mt-5 rounded-xl bg-white/20 px-4 py-2.5 text-sm text-white/90 backdrop-blur-sm">
                  통독 계획을 구독해주세요
                </p>
              </div>
            </div>
            <Link href="/plan" className="mt-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              📅 통독표 보기
            </Link>
          </div>
        </Container>
      )
    }

    const progress = await repositories.progress.getProgress(activeSubscription.id, schedule.id)
    const initialCompleted = progress?.isCompleted ?? false

    return (
      <Container fullHeight className="py-8">
        <div className="mx-auto max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            ← 홈으로
          </Link>
          <div className="relative w-full overflow-hidden rounded-3xl border border-white/20 p-6 shadow-[0_12px_26px_rgba(0,0,0,0.14)] bg-gradient-to-br from-sky-600 to-indigo-900 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_58%)]" />
            <div className="relative">
              <span className="text-xs font-semibold tracking-[0.18em] text-white/65 uppercase">TODAY&apos;S READING</span>
              <h2 className="mt-2 text-2xl leading-tight font-light" style={{ fontFamily: 'Georgia, "KoPub Batang", serif' }}>
                {schedule.book}
                <br />
                <strong className="font-bold">
                  {schedule.startChapter}-{schedule.endChapter}장
                </strong>
              </h2>
              <p className="mt-1 text-sm opacity-75">{schedule.date}</p>
              <div className="mt-5">
                <ReadingProgressButton
                  scheduleId={schedule.id}
                  subscriptionId={activeSubscription.id}
                  initialCompleted={initialCompleted}
                />
              </div>
            </div>
          </div>
          <Link href="/plan" className="mt-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            📅 통독표 보기
          </Link>
        </div>
      </Container>
    )
  } catch {
    return (
      <Container fullHeight className="py-8">
        <div className="mx-auto max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            ← 홈으로
          </Link>
          <EmptyCard>
            <p className="text-center text-sm text-white/80">일정을 불러오는 중 오류가 발생했습니다</p>
          </EmptyCard>
        </div>
      </Container>
    )
  }
}
