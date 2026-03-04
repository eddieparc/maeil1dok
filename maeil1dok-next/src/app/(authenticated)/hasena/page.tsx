import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import type { HasenaRecord } from '@/types'
import { HasenaClient } from '@/components/hasena/HasenaClient'

interface HasenaStatus {
  date: string
  isCompleted: boolean
}

interface HasenaStats {
  totalCompleted: number
  currentStreak: number
  longestStreak: number
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calculateHasenaStats(records: HasenaRecord[], today: string): HasenaStats {
  const completedDates = records
    .filter((record) => record.isCompleted)
    .map((record) => record.date)

  const completedSet = new Set(completedDates)
  const sortedCompletedDates = [...completedDates].sort()

  let currentStreak = 0
  const todayDate = new Date(`${today}T00:00:00`)
  while (true) {
    const dateStr = formatDate(todayDate)
    if (!completedSet.has(dateStr)) {
      break
    }
    currentStreak += 1
    todayDate.setDate(todayDate.getDate() - 1)
  }

  let longestStreak = 0
  let streak = 0
  let previousDate: Date | null = null

  for (const dateStr of sortedCompletedDates) {
    const currentDate = new Date(`${dateStr}T00:00:00`)
    if (!previousDate) {
      streak = 1
      previousDate = currentDate
      longestStreak = Math.max(longestStreak, streak)
      continue
    }

    const diffMs = currentDate.getTime() - previousDate.getTime()
    const diffDays = Math.round(diffMs / 86400000)
    if (diffDays === 1) {
      streak += 1
    } else if (diffDays === 0) {
      continue
    } else {
      streak = 1
    }

    previousDate = currentDate
    longestStreak = Math.max(longestStreak, streak)
  }

  return {
    totalCompleted: completedSet.size,
    currentStreak,
    longestStreak,
  }
}

export default async function HasenaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = formatDate(new Date())
  const repositories = createServerRepositories(supabase)

  let status: HasenaStatus = { date: today, isCompleted: false }
  let stats: HasenaStats = { totalCompleted: 0, currentStreak: 0, longestStreak: 0 }

  if (user) {
    const [todayRecord, recentRecords] = await Promise.all([
      repositories.hasena.getRecordByDate(today),
      repositories.hasena.getRecentRecords(3650),
    ])

    status = {
      date: today,
      isCompleted: todayRecord?.isCompleted ?? false,
    }
    stats = calculateHasenaStats(recentRecords, today)
  }

  return (
    <HasenaClient
      initialStatus={status}
      initialStats={stats}
      today={today}
      isAuthenticated={Boolean(user)}
    />
  )
}
