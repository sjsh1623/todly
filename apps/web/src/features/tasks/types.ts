import type { ProfileColor } from '../auth/types'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived'

export type TaskPriority = 'low' | 'medium' | 'high'

export type TaskProgress = {
  percent: number
  done: number
  total: number
}

export type TaskAssignee = {
  userId: string
  username: string
  nickname: string
  profileColor: ProfileColor
}

export type Subtask = {
  id: string
  title: string
  isDone: boolean
  position: number
}

export type TaskComment = {
  id: string
  author: {
    userId: string
    nickname: string
    profileColor: ProfileColor
  }
  body: string
  createdAt: string
}

export type TaskPhoto = {
  id: string
  url: string
  thumbUrl: string
  uploaderId: string
  createdAt: string
}

/** Per-task routine consistency: how many weeks this task's routine has run. */
export type TaskConsistency = {
  weeks: number
  /** Optional daily strip for the mini heatmap. */
  heatmap?: { day: string; done: boolean }[]
}

export type Task = {
  id: string
  groupId: string
  groupName?: string | null
  sectionId: string | null
  sectionTitle?: string | null
  title: string
  note: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  dueAt: string | null
  position: number
  version: number
  creatorId: string
  completedAt: string | null
  completedBy: string | null
  assignees: TaskAssignee[]
  subtasks: Subtask[]
  comments?: TaskComment[]
  photos?: TaskPhoto[]
  consistency?: TaskConsistency
}

export type Section = {
  id: string
  title: string
  position: number
  progress: { done: number; total: number }
  tasks: Task[]
}

/** Returned by GET /groups/{groupId}/tasks. */
export type GroupTasks = {
  progress: TaskProgress
  sections: Section[]
  unsectioned: Task[]
}

export type CreateTaskPayload = {
  groupId: string
  sectionId?: string
  title: string
  note?: string
  priority?: TaskPriority
  dueDate?: string
  assigneeIds?: string[]
}

export type UpdateTaskPayload = {
  version: number
  title?: string
  note?: string
  sectionId?: string | null
  priority?: TaskPriority
  dueDate?: string | null
}

// ---- Home dashboard ----

export type HomeGreeting = {
  phrase: string
  name: string
  date: string
}

export type NeedsAttentionItem = {
  taskId: string
  title: string
  groupId: string
  groupName: string
  dueDate: string | null
  level: 'danger' | 'warning'
  daysOverdue?: number
}

export type HomeGroupProgress = {
  groupId: string
  name: string
  color: string
  progress: TaskProgress
  members: {
    userId: string
    nickname: string
    profileColor: ProfileColor
  }[]
}

/** A "지금 활동 중" entry on the home dashboard. */
export type LiveNowEntry = {
  userId: string
  nickname: string
  profileColor: ProfileColor
  taskTitle: string
  startedAt: string
  status: 'active' | 'paused'
  taskId?: string
  groupName?: string
  sectionTitle?: string
}

export type HomeSummary = {
  greeting: HomeGreeting
  liveNow: LiveNowEntry[]
  needsAttention: NeedsAttentionItem[]
  groupProgress: HomeGroupProgress[]
}
