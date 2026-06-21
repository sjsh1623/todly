import { api } from '../../shared/lib/api'
import type {
  HeatmapResponse,
  MeStats,
  RecentActivity,
  RoutineConsistency,
} from './types'

export async function getStats(): Promise<MeStats> {
  const { data } = await api.get<MeStats>('/me/stats')
  return data
}

export async function getHeatmap(weeks = 16): Promise<HeatmapResponse> {
  const { data } = await api.get<HeatmapResponse>('/me/heatmap', { params: { weeks } })
  return data
}

export async function getRecentActivity(limit = 10): Promise<RecentActivity[]> {
  const { data } = await api.get<RecentActivity[]>('/me/recent-activity', { params: { limit } })
  return data
}

export async function getRoutineConsistency(): Promise<RoutineConsistency[]> {
  const { data } = await api.get<RoutineConsistency[]>('/routines/consistency')
  return data
}
