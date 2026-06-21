import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import * as activityApi from './api'
import type { Activity, ActivityPage } from './types'

/** `groupId` undefined → the merged "전체" feed. */
export const activityKeys = {
  all: ['activities'] as const,
  feed: (groupId?: string) => ['activities', 'feed', groupId ?? 'all'] as const,
}

export function useActivities(groupId?: string) {
  return useInfiniteQuery<ActivityPage>({
    queryKey: activityKeys.feed(groupId),
    queryFn: ({ pageParam }) =>
      groupId
        ? activityApi.getGroupActivities(groupId, pageParam as string | null)
        : activityApi.getActivities(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

/**
 * Prepends a freshly-arrived activity into every cached feed it belongs to:
 *  - the merged "전체" feed,
 *  - the per-group feed for its groupId (when known).
 * De-duped by id so a REST refetch + realtime echo don't double up.
 */
export function prependActivity(
  qc: ReturnType<typeof useQueryClient>,
  activity: Activity,
) {
  const keys = [activityKeys.feed(undefined)]
  if (activity.groupId) keys.push(activityKeys.feed(activity.groupId))

  for (const key of keys) {
    qc.setQueryData<InfiniteData<ActivityPage>>(key, (data) => {
      if (!data) return data
      const exists = data.pages.some((p) => p.items.some((a) => a.id === activity.id))
      if (exists) return data
      const [first, ...rest] = data.pages
      const firstPage: ActivityPage = first ?? { items: [], nextCursor: null }
      return {
        ...data,
        pages: [{ ...firstPage, items: [activity, ...firstPage.items] }, ...rest],
      }
    })
  }
}
