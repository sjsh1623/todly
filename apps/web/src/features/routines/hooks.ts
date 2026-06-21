import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as routinesApi from './api'
import type {
  CompleteRoutineResult,
  CreateRoutinePayload,
  Routine,
  UpdateRoutinePayload,
} from './types'

export const routineKeys = {
  all: ['routines'] as const,
  list: () => ['routines', 'list'] as const,
}

export function useRoutines() {
  return useQuery<Routine[]>({
    queryKey: routineKeys.list(),
    queryFn: routinesApi.listRoutines,
  })
}

export function useCreateRoutine() {
  const qc = useQueryClient()
  return useMutation<Routine, unknown, CreateRoutinePayload>({
    mutationFn: routinesApi.createRoutine,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routineKeys.list() })
    },
  })
}

export function useUpdateRoutine() {
  const qc = useQueryClient()
  return useMutation<Routine, unknown, { id: string; payload: UpdateRoutinePayload }>({
    mutationFn: ({ id, payload }) => routinesApi.updateRoutine(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routineKeys.list() })
    },
  })
}

export function useDeleteRoutine() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: routinesApi.deleteRoutine,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routineKeys.list() })
    },
  })
}

export function useToggleRoutine() {
  const qc = useQueryClient()
  return useMutation<Routine, unknown, string>({
    mutationFn: routinesApi.toggleRoutine,
    onSuccess: (routine) => {
      qc.setQueryData<Routine[]>(routineKeys.list(), (list) =>
        list?.map((r) => (r.id === routine.id ? routine : r)),
      )
    },
  })
}

export function useCompleteRoutine() {
  const qc = useQueryClient()
  return useMutation<CompleteRoutineResult, unknown, string>({
    mutationFn: routinesApi.completeRoutine,
    onSuccess: (result, id) => {
      qc.setQueryData<Routine[]>(routineKeys.list(), (list) =>
        list?.map((r) =>
          r.id === id ? { ...r, todayDone: result.todayDone, streak: result.streak } : r,
        ),
      )
    },
  })
}

export function useSkipRoutine() {
  const qc = useQueryClient()
  return useMutation<Routine, unknown, string>({
    mutationFn: routinesApi.skipRoutine,
    onSuccess: (routine) => {
      qc.setQueryData<Routine[]>(routineKeys.list(), (list) =>
        list?.map((r) => (r.id === routine.id ? routine : r)),
      )
    },
  })
}
