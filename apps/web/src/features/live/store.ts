import { create } from 'zustand'
import type { LiveSession } from './types'

type PresenceState = {
  /** onlineCount keyed by groupId, kept live by presence.updated events. */
  onlineByGroup: Record<string, number>
  /** Active live sessions keyed by sessionId. */
  sessions: Record<string, LiveSession>
}

type PresenceActions = {
  setOnline: (groupId: string, count: number) => void
  upsertSession: (session: LiveSession) => void
  removeSession: (sessionId: string) => void
  removeSessionByTask: (taskId: string) => void
  reset: () => void
}

export const useLiveStore = create<PresenceState & PresenceActions>((set) => ({
  onlineByGroup: {},
  sessions: {},

  setOnline: (groupId, count) =>
    set((s) => ({ onlineByGroup: { ...s.onlineByGroup, [groupId]: count } })),

  upsertSession: (session) =>
    set((s) => ({ sessions: { ...s.sessions, [session.id]: session } })),

  removeSession: (sessionId) =>
    set((s) => {
      if (!s.sessions[sessionId]) return s
      const next = { ...s.sessions }
      delete next[sessionId]
      return { sessions: next }
    }),

  removeSessionByTask: (taskId) =>
    set((s) => {
      const next: Record<string, LiveSession> = {}
      for (const [id, sess] of Object.entries(s.sessions)) {
        if (sess.taskId !== taskId) next[id] = sess
      }
      return { sessions: next }
    }),

  reset: () => set({ onlineByGroup: {}, sessions: {} }),
}))

/** Returns the active live session for a task (if any), preferring `active`. */
export function selectSessionForTask(
  sessions: Record<string, LiveSession>,
  taskId: string,
): LiveSession | undefined {
  let paused: LiveSession | undefined
  for (const sess of Object.values(sessions)) {
    if (sess.taskId !== taskId) continue
    if (sess.status === 'active') return sess
    paused = sess
  }
  return paused
}
