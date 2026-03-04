export const dynamic = 'force-dynamic'

import GroupsClient from '@/components/groups/GroupsClient'
import { getGroups } from '@/repositories/groupsRepository'

export default async function GroupsPage() {
  const groups = await getGroups()
  return <GroupsClient groups={groups} />
}
