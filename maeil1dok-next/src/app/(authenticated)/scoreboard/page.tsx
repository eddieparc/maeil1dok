export const dynamic = 'force-dynamic'

import ScoreboardClient from '@/components/scoreboard/ScoreboardClient'
import { getScoreboardData } from '@/repositories/scoreboardRepository'

export default async function ScoreboardPage() {
  const scoreboard = await getScoreboardData()
  return <ScoreboardClient scoreboard={scoreboard} />
}
