import { api } from '../../shared/lib/api'
import type { ActivityPage } from './types'

const PAGE_LIMIT = 20

/** Merged "전체" feed across all of my groups. */
export async function getActivities(cursor?: string | null): Promise<ActivityPage> {
  const { data } = await api.get<ActivityPage>('/activities', {
    params: { cursor: cursor ?? undefined, limit: PAGE_LIMIT },
  })
  return data
}

/** A single group's activity feed (used by the per-group filter chips). */
export async function getGroupActivities(
  groupId: string,
  cursor?: string | null,
): Promise<ActivityPage> {
  const { data } = await api.get<ActivityPage>(`/groups/${groupId}/activities`, {
    params: { cursor: cursor ?? undefined, limit: PAGE_LIMIT },
  })
  return data
}
