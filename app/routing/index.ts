const boardBase = (wsId: string, boardId: string) =>
  `/api/workspaces/${wsId}/boards/${boardId}`

export const apiRoutes = {
  authRegister: '/api/auth/register',
  authLogin: '/api/auth/login',
  authLogout: '/api/auth/logout',
  authSession: '/api/auth/session',
  authVerifyEmail: (token: string) => `/api/auth/verify-email/${token}`,
  authResendVerification: '/api/auth/resend-verification',
  authForgotPassword: '/api/auth/password/forgot',
  authResetPassword: '/api/auth/password/reset',
  authResetPasswordStatus: (token: string) => `/api/auth/password/reset/${token}`,

  usersMe: '/api/users/me',

  healthz: '/api/healthz',

  workspaces: '/api/workspaces',
  workspace: (id: string) => `/api/workspaces/${id}`,

  members: (wsId: string) => `/api/workspaces/${wsId}/members`,
  member: (wsId: string, userId: string) => `/api/workspaces/${wsId}/members/${userId}`,

  boards: (wsId: string) => `/api/workspaces/${wsId}/boards`,
  board: boardBase,
  boardSleRecompute: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/sle/recompute`,
  boardReplenishment: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/replenishment`,

  columns: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/columns`,
  column: (wsId: string, boardId: string, columnId: string) =>
    `${boardBase(wsId, boardId)}/columns/${columnId}`,
  columnsReorder: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/columns/reorder`,

  tasks: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/tasks`,
  task: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}`,
  taskMove: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/move`,
  taskEvents: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/events`,
  taskSubtasks: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/subtasks`,
  taskDependencies: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/dependencies`,
  taskDependency: (wsId: string, boardId: string, taskId: string, blockerTaskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/dependencies/${blockerTaskId}`,
  boardDependencyCounts: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/dependencies`,
  taskAssignees: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/assignees`,
  taskAssignee: (wsId: string, boardId: string, taskId: string, userId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/assignees/${userId}`,

  taskChecklist: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/checklist`,
  taskChecklistItem: (wsId: string, boardId: string, taskId: string, itemId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/checklist/${itemId}`,
  taskChecklistReorder: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/checklist/reorder`,

  taskComments: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/comments`,
  taskComment: (wsId: string, boardId: string, taskId: string, commentId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/comments/${commentId}`,

  sprints: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/sprints`,
  sprint: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}`,
  sprintStart: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/start`,
  sprintClose: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/close`,
  sprintBurndown: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/burndown`,
  sprintTasks: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/tasks`,
  sprintTask: (wsId: string, boardId: string, sprintId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/tasks/${taskId}`,
  boardSprintMemberships: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/sprint-memberships`,

  analyticsCfd: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/cfd`,
  analyticsCycleTime: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/cycle-time`,
  analyticsMonteCarlo: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/monte-carlo`,
  analyticsThroughput: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/throughput`,
  analyticsWipRecommendations: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/wip-recommendations`,

  boardStream: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/stream`,

  workspaceActivity: (wsId: string) => `/api/workspaces/${wsId}/activity`,

  notifications: '/api/notifications',
  notificationsUnreadCount: '/api/notifications/unread-count',
  notificationRead: (id: string) => `/api/notifications/${id}/read`,
  notificationsReadAll: '/api/notifications/read-all',
  notificationsStream: '/api/notifications/stream',
} as const

export const pageRoutes = {
  home: '/',
  login: '/login',
  register: '/register',
  verifyEmail: (token: string) => `/verify-email/${token}`,
  forgotPassword: '/forgot-password',
  resetPassword: (token: string) => `/reset-password/${token}`,

  me: '/me',

  workspaces: '/workspaces',
  workspace: (id: string) => `/workspaces/${id}`,
  workspaceMembers: (id: string) => `/workspaces/${id}/members`,
  workspaceSettings: (id: string) => `/workspaces/${id}/settings`,
  workspaceActivity: (id: string) => `/workspaces/${id}/activity`,

  boards: (wsId: string) => `/workspaces/${wsId}/boards`,
  board: (wsId: string, boardId: string) => `/workspaces/${wsId}/boards/${boardId}`,
  boardAnalytics: (wsId: string, boardId: string) =>
    `/workspaces/${wsId}/boards/${boardId}/analytics`,
  boardSprints: (wsId: string, boardId: string) =>
    `/workspaces/${wsId}/boards/${boardId}/sprints`,
  boardCalendar: (wsId: string, boardId: string) =>
    `/workspaces/${wsId}/boards/${boardId}/calendar`,
  boardTimeline: (wsId: string, boardId: string) =>
    `/workspaces/${wsId}/boards/${boardId}/timeline`,
  task: (wsId: string, boardId: string, taskId: string) => ({
    path: `/workspaces/${wsId}/boards/${boardId}`,
    query: { task: taskId },
  }),
} as const

export type ApiRoutes = typeof apiRoutes
export type PageRoutes = typeof pageRoutes