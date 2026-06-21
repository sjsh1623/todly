import { useQuery } from '@tanstack/react-query'
import * as statsApi from './api'
import type {
  HeatmapResponse,
  MeStats,
  RecentActivity,
  RoutineConsistency,
} from './types'

export const statsKeys = {
  stats: ['me', 'stats'] as const,
  heatmap: (weeks: number) => ['me', 'heatmap', weeks] as const,
  recentActivity: (limit: number) => ['me', 'recent-activity', limit] as const,
  routineConsistency: ['routines', 'consistency'] as const,
}

export function useStats() {
  return useQuery<MeStats>({
    queryKey: statsKeys.stats,
    queryFn: statsApi.getStats,
  })
}

export function useHeatmap(weeks = 16) {
  return useQuery<HeatmapResponse>({
    queryKey: statsKeys.heatmap(weeks),
    queryFn: () => statsApi.getHeatmap(weeks),
  })
}

export function useRecentActivity(limit = 10) {
  return useQuery<RecentActivity[]>({
    queryKey: statsKeys.recentActivity(limit),
    queryFn: () => statsApi.getRecentActivity(limit),
  })
}

export function useRoutineConsistency() {
  return useQuery<RoutineConsistency[]>({
    queryKey: statsKeys.routineConsistency,
    queryFn: statsApi.getRoutineConsistency,
  })
}
