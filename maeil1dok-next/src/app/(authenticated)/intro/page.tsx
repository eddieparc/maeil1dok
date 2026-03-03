export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import IntroClient from '@/components/intro/IntroClient'
import type { VideoBibleIntro, VideoIntroProgress } from '@/types'
import { Container, PageHeader } from '@/components/ui'

interface PlanInfo {
  id: number
  name: string
}

export default async function IntroPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    // Get user's subscribed plans (active only)
    const { data: subscriptions } = await supabase
      .from('plan_subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const planIds = (subscriptions ?? []).map(s => s.plan_id)

    if (planIds.length === 0) {
      return (
        <Container className="pb-20">
          <PageHeader title="성경 개론" />
          <div className="px-4 py-6">
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              구독 중인 플랜이 없습니다. 플랜을 먼저 구독해주세요.
            </p>
          </div>
        </Container>
      )
    }

    // Get plan details for selector
    const { data: plans } = await supabase
      .from('bible_reading_plans')
      .select('id, name')
      .in('id', planIds)

    const planList: PlanInfo[] = (plans ?? []).map(p => ({ id: p.id, name: p.name }))

    // Get video intros for user's plans
    const { data: videoIntrosRaw } = await supabase
      .from('video_bible_intros')
      .select('*')
      .in('plan_id', planIds)
      .order('start_date')

    const videoIntros: VideoBibleIntro[] = (videoIntrosRaw ?? []).map(row => ({
      id: row.id,
      planId: row.plan_id,
      book: row.book,
      urlLink: row.url_link,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    // Get user's progress for video intros
    const videoIntroIds = videoIntros.map(v => v.id)
    let progressList: VideoIntroProgress[] = []

    if (videoIntroIds.length > 0) {
      const { data: progressRaw } = await supabase
        .from('user_video_intro_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('video_intro_id', videoIntroIds)

      progressList = (progressRaw ?? []).map(row => ({
        id: row.id,
        userId: row.user_id,
        videoIntroId: row.video_intro_id,
        isCompleted: row.is_completed,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    }

    return (
      <Container className="pb-20">
        <PageHeader title="성경 개론" />
        <IntroClient
          plans={planList}
          videoIntros={videoIntros}
          progressList={progressList}
        />
      </Container>
    )
  } catch {
    return (
      <Container>
        <PageHeader title="성경 개론" />
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-sm text-red-600">
            개론 목록을 불러오는 중 오류가 발생했습니다
          </p>
        </div>
      </Container>
    )
  }
}
