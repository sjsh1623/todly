import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as liveApi from './api'
import { useLiveStore } from './store'
import { taskKeys } from '../tasks/hooks'
import { groupKeys } from '../groups/hooks'
import type { GroupTasks, Task } from '../tasks/types'
import type { GroupDetail } from '../groups/types'
import {
  elapsedSeconds,
  formatBy,
  type ElapsedFormat,
  type LiveSessionStatus,
} from './elapsed'

// ---- A single shared 1Hz ticker so we don't run one interval per card ----

const tickListeners = new Set<() => void>()
let tickTimer: ReturnType<typeof setInterval> | null = null

function startTicker() {
  if (tickTimer) return
  tickTimer = setInterval(() => {
    for (const l of tickListeners) l()
  }, 1000)
}

function subscribeTick(listener: () => void): () => void {
  tickListeners.add(listener)
  startTicker()
  return () => {
    tickListeners.delete(listener)
    if (tickListeners.size === 0 && tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }
}

/**
 * Returns a live-ticking formatted elapsed string for a session.
 * Re-renders once per second off a single shared interval. When `status` is
 * 'paused' the timer freezes (no tick subscription).
 */
export function useElapsed(
  startedAt: string | undefined,
  pausedSeconds = 0,
  status: LiveSessionStatus = 'active',
  format: ElapsedFormat = 'short',
): string {
  const [, force] = useState(0)
  const running = status === 'active' && Boolean(startedAt)

  useEffect(() => {
    if (!running) return
    return subscribeTick(() => force((n) => n + 1))
  }, [running])

  if (!startedAt) return ''
  return formatBy(format, elapsedSeconds(startedAt, pausedSeconds))
}

// ---- Live session mutations ----

/** Updates the task's status in the cached GroupTasks tree (no progress change). */
function setTaskStatusInCache(
  qc: ReturnType<typeof useQueryClient>,
  groupId: string,
  taskId: string,
  status: Task['status'],
) {
  const key = taskKeys.groupTasks(groupId)
  const data = qc.getQueryData<GroupTasks>(key)
  if (!data) return
  const apply = (t: Task): Task => (t.id === taskId ? { ...t, status } : t)
  qc.setQueryData<GroupTasks>(key, {
    ...data,
    sections: data.sections.map((s) => ({ ...s, tasks: s.tasks.map(apply) })),
    unsectioned: data.unsectioned.map(apply),
  })
}

type LiveVars = { taskId: string; groupId: string }

export function useStartLive() {
  const qc = useQueryClient()
  const upsertSession = useLiveStore((s) => s.upsertSession)
  return useMutation({
    mutationFn: ({ taskId }: LiveVars) => liveApi.startLive(taskId),
    onSuccess: (session, vars) => {
      upsertSession({ ...session, groupId: session.groupId ?? vars.groupId })
      setTaskStatusInCache(qc, vars.groupId, vars.taskId, 'in_progress')
      qc.invalidateQueries({ queryKey: taskKeys.home })
    },
  })
}

export function usePauseLive() {
  const upsertSession = useLiveStore((s) => s.upsertSession)
  return useMutation({
    mutationFn: ({ taskId, paused }: LiveVars & { paused: boolean }) =>
      liveApi.pauseLive(taskId, paused),
    onSuccess: (session, vars) => upsertSession({ ...session, groupId: session.groupId ?? vars.groupId }),
  })
}

export function useStopLive() {
  const qc = useQueryClient()
  const removeSessionByTask = useLiveStore((s) => s.removeSessionByTask)
  return useMutation({
    mutationFn: ({ taskId }: LiveVars) => liveApi.stopLive(taskId),
    onSuccess: (_data, vars) => {
      removeSessionByTask(vars.taskId)
      setTaskStatusInCache(qc, vars.groupId, vars.taskId, 'todo')
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(vars.groupId) })
      qc.invalidateQueries({ queryKey: taskKeys.home })
    },
  })
}

// ---- Presence heartbeat ----

const HEARTBEAT_MS = 30_000

/**
 * Posts /presence/heartbeat every ~30s while `enabled`. Fires once immediately
 * so presence registers as soon as the app mounts.
 */
export function useHeartbeat(enabled: boolean) {
  const savedEnabled = useRef(enabled)
  savedEnabled.current = enabled

  useEffect(() => {
    if (!enabled) return
    const beat = () => {
      void liveApi.sendHeartbeat().catch(() => {})
    }
    beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [enabled])
}

// ---- Convenience reactive selectors ----

/** Live onlineCount for a group, falling back to the group detail cache value. */
export function useGroupOnlineCount(groupId: string | undefined): number | undefined {
  const qc = useQueryClient()
  const live = useLiveStore((s) => (groupId ? s.onlineByGroup[groupId] : undefined))
  if (live !== undefined) return live
  if (!groupId) return undefined
  return qc.getQueryData<GroupDetail>(groupKeys.detail(groupId))?.onlineCount
}
