import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../auth'
import * as tasksApi from './api'
import type {
  CreateTaskPayload,
  GroupTasks,
  HomeSummary,
  Section,
  Subtask,
  Task,
  TaskComment,
  TaskPhoto,
} from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  home: ['home'] as const,
  groupTasks: (groupId: string) => ['groupTasks', groupId] as const,
  detail: (id: string) => ['task', id] as const,
}

export function useHomeSummary() {
  return useQuery<HomeSummary>({
    queryKey: taskKeys.home,
    queryFn: tasksApi.getHomeSummary,
  })
}

export function useGroupTasks(groupId: string | undefined) {
  return useQuery<GroupTasks>({
    queryKey: taskKeys.groupTasks(groupId ?? ''),
    queryFn: () => tasksApi.getGroupTasks(groupId as string),
    enabled: Boolean(groupId),
  })
}

export function useTask(id: string | undefined) {
  return useQuery<Task>({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => tasksApi.getTask(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation<Task, unknown, CreateTaskPayload>({
    mutationFn: tasksApi.createTask,
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(task.groupId) })
      qc.invalidateQueries({ queryKey: taskKeys.home })
    },
  })
}

// --- Helpers for optimistically rewriting the cached GroupTasks tree ---

/** Recomputes a {done,total} pair from a list of tasks (ignores archived). */
function tally(tasks: Task[]): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const t of tasks) {
    if (t.status === 'archived') continue
    total += 1
    if (t.status === 'done') done += 1
  }
  return { done, total }
}

function percentOf(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100)
}

/**
 * Returns a new GroupTasks tree with the given task flipped to `nextStatus`,
 * recomputing per-section and overall progress so the UI updates instantly.
 */
function flipTaskStatus(
  data: GroupTasks,
  taskId: string,
  nextStatus: Task['status'],
): GroupTasks {
  const apply = (t: Task): Task => (t.id === taskId ? { ...t, status: nextStatus } : t)

  const sections = data.sections.map((section) => {
    const tasks = section.tasks.map(apply)
    return { ...section, tasks, progress: tally(tasks) }
  })
  const unsectioned = data.unsectioned.map(apply)

  // Overall = every non-archived task across the tree.
  const all = [...sections.flatMap((s) => s.tasks), ...unsectioned]
  const { done, total } = tally(all)

  return {
    sections,
    unsectioned,
    progress: { done, total, percent: percentOf(done, total) },
  }
}

type ToggleVars = { taskId: string; groupId: string; currentStatus: Task['status'] }
type ToggleContext = {
  prevGroupTasks?: GroupTasks
  prevHome?: HomeSummary
  groupId: string
}

/**
 * Optimistically completes/reopens a task.
 *
 * onMutate cancels in-flight queries, snapshots ['groupTasks', groupId] and
 * ['home'], then flips the task's status locally (and recomputes progress).
 * onError restores both snapshots. onSettled invalidates both keys so the
 * server truth wins. The home list also drops/keeps the task in needsAttention.
 */
export function useToggleComplete() {
  const qc = useQueryClient()
  return useMutation<Task, unknown, ToggleVars, ToggleContext>({
    mutationFn: ({ taskId, currentStatus }) =>
      currentStatus === 'done' ? tasksApi.reopenTask(taskId) : tasksApi.completeTask(taskId),

    onMutate: async ({ taskId, groupId, currentStatus }) => {
      const groupKey = taskKeys.groupTasks(groupId)
      await Promise.all([
        qc.cancelQueries({ queryKey: groupKey }),
        qc.cancelQueries({ queryKey: taskKeys.home }),
      ])

      const prevGroupTasks = qc.getQueryData<GroupTasks>(groupKey)
      const prevHome = qc.getQueryData<HomeSummary>(taskKeys.home)

      const nextStatus: Task['status'] = currentStatus === 'done' ? 'todo' : 'done'

      if (prevGroupTasks) {
        qc.setQueryData<GroupTasks>(groupKey, flipTaskStatus(prevGroupTasks, taskId, nextStatus))
      }

      // On the home dashboard, completing a task removes it from needsAttention.
      if (prevHome && nextStatus === 'done') {
        qc.setQueryData<HomeSummary>(taskKeys.home, {
          ...prevHome,
          needsAttention: prevHome.needsAttention.filter((n) => n.taskId !== taskId),
        })
      }

      return { prevGroupTasks, prevHome, groupId }
    },

    onError: (_err, _vars, ctx) => {
      if (!ctx) return
      if (ctx.prevGroupTasks) {
        qc.setQueryData(taskKeys.groupTasks(ctx.groupId), ctx.prevGroupTasks)
      }
      if (ctx.prevHome) {
        qc.setQueryData(taskKeys.home, ctx.prevHome)
      }
    },

    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(vars.groupId) })
      qc.invalidateQueries({ queryKey: taskKeys.home })
    },
  })
}

type AssignSelfVars = { taskId: string; groupId: string; userId: string }

/** Assigns the current user to a task ("내가 할게요"). */
export function useAssignSelf() {
  const qc = useQueryClient()
  return useMutation<Task, unknown, AssignSelfVars>({
    mutationFn: ({ taskId, userId }) => tasksApi.assignTask(taskId, userId),
    onSuccess: (task, vars) => {
      // Replace the task in the cached tree with the server's version.
      const groupKey = taskKeys.groupTasks(vars.groupId)
      const data = qc.getQueryData<GroupTasks>(groupKey)
      if (data) {
        const replace = (t: Task): Task => (t.id === task.id ? task : t)
        qc.setQueryData<GroupTasks>(groupKey, {
          ...data,
          sections: data.sections.map((s) => ({ ...s, tasks: s.tasks.map(replace) })),
          unsectioned: data.unsectioned.map(replace),
        })
      }
      qc.invalidateQueries({ queryKey: groupKey })
      qc.invalidateQueries({ queryKey: taskKeys.home })
    },
  })
}

export function useCreateSection(groupId: string) {
  const qc = useQueryClient()
  return useMutation<Section, unknown, string>({
    mutationFn: (title) => tasksApi.createSection(groupId, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(groupId) })
    },
  })
}

export function useCreateSubtask(groupId: string) {
  const qc = useQueryClient()
  return useMutation<Subtask, unknown, { taskId: string; title: string }>({
    mutationFn: ({ taskId, title }) => tasksApi.createSubtask(taskId, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(groupId) })
    },
  })
}

export function useUpdateSubtask(groupId: string) {
  const qc = useQueryClient()
  return useMutation<Subtask, unknown, { id: string; isDone?: boolean; title?: string }>({
    mutationFn: ({ id, ...payload }) => tasksApi.updateSubtask(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(groupId) })
    },
  })
}

export function useDeleteSubtask(groupId: string) {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: tasksApi.deleteSubtask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(groupId) })
    },
  })
}

// --- Task-detail-scoped subtask mutations (optimistic on ['task', id]) ---

/** Patches a subtask in the cached task detail, then reconciles with the server. */
export function useToggleSubtask(taskId: string) {
  const qc = useQueryClient()
  return useMutation<
    Subtask,
    unknown,
    { id: string; isDone: boolean },
    { prev?: Task }
  >({
    mutationFn: ({ id, isDone }) => tasksApi.updateSubtask(id, { isDone }),
    onMutate: async ({ id, isDone }) => {
      const key = taskKeys.detail(taskId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Task>(key)
      if (prev) {
        qc.setQueryData<Task>(key, {
          ...prev,
          subtasks: prev.subtasks.map((s) => (s.id === id ? { ...s, isDone } : s)),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(taskKeys.detail(taskId), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
    },
  })
}

/** Adds a subtask to the cached task detail. */
export function useAddSubtask(taskId: string) {
  const qc = useQueryClient()
  return useMutation<Subtask, unknown, string>({
    mutationFn: (title) => tasksApi.createSubtask(taskId, title),
    onSuccess: (subtask) => {
      const key = taskKeys.detail(taskId)
      const prev = qc.getQueryData<Task>(key)
      if (prev) {
        qc.setQueryData<Task>(key, { ...prev, subtasks: [...prev.subtasks, subtask] })
      }
    },
  })
}

/** Removes a subtask from the cached task detail. */
export function useRemoveSubtask(taskId: string) {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: (id) => tasksApi.deleteSubtask(id),
    onSuccess: (_data, id) => {
      const key = taskKeys.detail(taskId)
      const prev = qc.getQueryData<Task>(key)
      if (prev) {
        qc.setQueryData<Task>(key, {
          ...prev,
          subtasks: prev.subtasks.filter((s) => s.id !== id),
        })
      }
    },
  })
}

// --- Comments ---

/** Optimistically appends a comment to the cached task detail. */
export function useAddComment(taskId: string) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation<TaskComment, unknown, string, { prev?: Task; tempId: string }>({
    mutationFn: (body) => tasksApi.addComment(taskId, body),
    onMutate: async (body) => {
      const key = taskKeys.detail(taskId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Task>(key)
      const tempId = `temp-${Date.now()}`
      if (prev && user) {
        const optimistic: TaskComment = {
          id: tempId,
          author: {
            userId: user.id,
            nickname: user.nickname,
            profileColor: user.profileColor,
          },
          body,
          createdAt: new Date().toISOString(),
        }
        qc.setQueryData<Task>(key, {
          ...prev,
          comments: [...(prev.comments ?? []), optimistic],
        })
      }
      return { prev, tempId }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(taskKeys.detail(taskId), ctx.prev)
    },
    onSuccess: (comment, _body, ctx) => {
      // Swap the optimistic placeholder for the server's comment.
      const key = taskKeys.detail(taskId)
      const cur = qc.getQueryData<Task>(key)
      if (cur && ctx) {
        qc.setQueryData<Task>(key, {
          ...cur,
          comments: (cur.comments ?? []).map((c) => (c.id === ctx.tempId ? comment : c)),
        })
      }
    },
  })
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: (id) => tasksApi.deleteComment(id),
    onSuccess: (_data, id) => {
      const key = taskKeys.detail(taskId)
      const prev = qc.getQueryData<Task>(key)
      if (prev) {
        qc.setQueryData<Task>(key, {
          ...prev,
          comments: (prev.comments ?? []).filter((c) => c.id !== id),
        })
      }
    },
  })
}

// --- Photos ---

/** Uploads a photo and appends it to the cached task detail. */
export function useUploadTaskPhoto(taskId: string) {
  const qc = useQueryClient()
  return useMutation<TaskPhoto, unknown, File>({
    mutationFn: (file) => tasksApi.uploadTaskPhoto(taskId, file),
    onSuccess: (photo) => {
      const key = taskKeys.detail(taskId)
      const prev = qc.getQueryData<Task>(key)
      if (prev) {
        qc.setQueryData<Task>(key, { ...prev, photos: [...(prev.photos ?? []), photo] })
      }
    },
  })
}

// --- Detail-scoped complete/reopen & delete (reconcile ['task', id]) ---

/** Completes or reopens a task and writes the result into the detail cache. */
export function useSetTaskStatus(taskId: string) {
  const qc = useQueryClient()
  return useMutation<Task, unknown, { complete: boolean; groupId: string }>({
    mutationFn: ({ complete }) =>
      complete ? tasksApi.completeTask(taskId) : tasksApi.reopenTask(taskId),
    onSuccess: (task, vars) => {
      qc.setQueryData<Task>(taskKeys.detail(taskId), task)
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(vars.groupId) })
      qc.invalidateQueries({ queryKey: taskKeys.home })
    },
  })
}

/** Deletes a task and invalidates its group/home caches. */
export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation<void, unknown, { taskId: string; groupId: string }>({
    mutationFn: ({ taskId }) => tasksApi.deleteTask(taskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(vars.groupId) })
      qc.invalidateQueries({ queryKey: taskKeys.home })
    },
  })
}

/** Assigns the current user to a task and writes the result into the detail cache. */
export function useAssignSelfDetail(taskId: string) {
  const qc = useQueryClient()
  return useMutation<Task, unknown, { userId: string; groupId: string }>({
    mutationFn: ({ userId }) => tasksApi.assignTask(taskId, userId),
    onSuccess: (task, vars) => {
      qc.setQueryData<Task>(taskKeys.detail(taskId), task)
      qc.invalidateQueries({ queryKey: taskKeys.groupTasks(vars.groupId) })
    },
  })
}
