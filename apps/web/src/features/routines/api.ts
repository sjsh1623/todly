import { api } from '../../shared/lib/api'
import type {
  CompleteRoutineResult,
  CreateRoutinePayload,
  Routine,
  UpdateRoutinePayload,
} from './types'

export async function listRoutines(): Promise<Routine[]> {
  const { data } = await api.get<Routine[]>('/routines')
  return data
}

export async function createRoutine(payload: CreateRoutinePayload): Promise<Routine> {
  const { data } = await api.post<Routine>('/routines', payload)
  return data
}

export async function updateRoutine(id: string, payload: UpdateRoutinePayload): Promise<Routine> {
  const { data } = await api.patch<Routine>(`/routines/${id}`, payload)
  return data
}

export async function deleteRoutine(id: string): Promise<void> {
  await api.delete(`/routines/${id}`)
}

export async function toggleRoutine(id: string): Promise<Routine> {
  const { data } = await api.post<Routine>(`/routines/${id}/toggle`)
  return data
}

export async function completeRoutine(id: string): Promise<CompleteRoutineResult> {
  const { data } = await api.post<CompleteRoutineResult>(`/routines/${id}/complete`)
  return data
}

export async function skipRoutine(id: string): Promise<Routine> {
  const { data } = await api.post<Routine>(`/routines/${id}/skip`)
  return data
}
