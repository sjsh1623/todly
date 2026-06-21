import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
import type { ApiError } from '../auth/types'
import type {
  CreateTaskPayload,
  GroupTasks,
  HomeSummary,
  Section,
  Subtask,
  Task,
  TaskComment,
  TaskPhoto,
  UpdateTaskPayload,
} from './types'

export async function getHomeSummary(): Promise<HomeSummary> {
  const { data } = await api.get<HomeSummary>('/home/summary')
  return data
}

export async function getGroupTasks(groupId: string): Promise<GroupTasks> {
  const { data } = await api.get<GroupTasks>(`/groups/${groupId}/tasks`)
  return data
}

export async function getTask(id: string): Promise<Task> {
  const { data } = await api.get<Task>(`/tasks/${id}`)
  return data
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const { data } = await api.post<Task>('/tasks', payload)
  return data
}

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${id}`, payload)
  return data
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`)
}

export async function completeTask(id: string): Promise<Task> {
  const { data } = await api.post<Task>(`/tasks/${id}/complete`)
  return data
}

export async function reopenTask(id: string): Promise<Task> {
  const { data } = await api.post<Task>(`/tasks/${id}/reopen`)
  return data
}

export async function assignTask(id: string, userId: string): Promise<Task> {
  const { data } = await api.post<Task>(`/tasks/${id}/assignees`, { userId })
  return data
}

export async function unassignTask(id: string, userId: string): Promise<Task> {
  const { data } = await api.delete<Task>(`/tasks/${id}/assignees/${userId}`)
  return data
}

export async function createSection(groupId: string, title: string): Promise<Section> {
  const { data } = await api.post<Section>(`/groups/${groupId}/sections`, { title })
  return data
}

export async function updateSection(id: string, title: string): Promise<Section> {
  const { data } = await api.patch<Section>(`/sections/${id}`, { title })
  return data
}

export async function deleteSection(id: string): Promise<void> {
  await api.delete(`/sections/${id}`)
}

export async function createSubtask(taskId: string, title: string): Promise<Subtask> {
  const { data } = await api.post<Subtask>(`/tasks/${taskId}/subtasks`, { title })
  return data
}

export async function updateSubtask(
  id: string,
  payload: { isDone?: boolean; title?: string },
): Promise<Subtask> {
  const { data } = await api.patch<Subtask>(`/subtasks/${id}`, payload)
  return data
}

export async function deleteSubtask(id: string): Promise<void> {
  await api.delete(`/subtasks/${id}`)
}

// ---- Comments ----

export async function addComment(taskId: string, body: string): Promise<TaskComment> {
  const { data } = await api.post<TaskComment>(`/tasks/${taskId}/comments`, { body })
  return data
}

export async function deleteComment(id: string): Promise<void> {
  await api.delete(`/comments/${id}`)
}

// ---- Photos ----

/** Uploads a task photo via multipart/form-data (field "file"). */
export async function uploadTaskPhoto(taskId: string, file: File): Promise<TaskPhoto> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<TaskPhoto>(`/tasks/${taskId}/photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

const ERROR_MESSAGES: Record<string, string> = {
  VERSION_CONFLICT: '다른 사람이 먼저 수정했어요. 새로고침 해주세요',
  FORBIDDEN: '이 작업을 할 권한이 없어요',
  TASK_NOT_FOUND: '투두를 찾을 수 없어요',
  SECTION_NOT_FOUND: '리스트를 찾을 수 없어요',
  GROUP_NOT_FOUND: '그룹을 찾을 수 없어요',
}

/** Reads the API error code from an axios error, if present. */
export function getApiErrorCode(error: unknown): string | undefined {
  if (isAxiosError<ApiError>(error)) return error.response?.data?.code
  return undefined
}

/** Maps a tasks API error to a user-facing Korean message. */
export function getTaskErrorMessage(
  error: unknown,
  fallback = '문제가 발생했어요. 다시 시도해 주세요',
): string {
  if (isAxiosError<ApiError>(error)) {
    const code = error.response?.data?.code
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
    if (error.response?.data?.message) return error.response.data.message
  }
  return fallback
}
