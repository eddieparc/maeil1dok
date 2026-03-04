export const dynamic = 'force-dynamic'

import GroupDetailClient from '@/components/groups/GroupDetailClient'
import { getGroupById } from '@/repositories/groupsRepository'

interface GroupDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = await params
  const groupId = Number.parseInt(id, 10)
  const group = Number.isNaN(groupId) ? null : await getGroupById(groupId)

  return <GroupDetailClient group={group} />
}
