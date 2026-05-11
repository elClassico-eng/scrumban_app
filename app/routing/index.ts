const boardBase = (wsId: string, boardId: string) =>
  `/api/workspaces/${wsId}/boards/${boardId}`

export const apiRoutes = {
  authRegister: '/api/auth/register',
  authLogin: '/api/auth/login',
  authLogout: '/api/auth/logout',
  authSession: '/api/auth/session',

  healthz: '/api/healthz',

  workspaces: '/api/workspaces',
  workspace: (id: string) => `/api/workspaces/${id}`,

  members: (wsId: string) => `/api/workspaces/${wsId}/members`,
  member: (wsId: string, userId: string) => `/api/workspaces/${wsId}/members/${userId}`,

  boards: (wsId: string) => `/api/workspaces/${wsId}/boards`,
  board: boardBase,

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

  sprints: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/sprints`,
  sprint: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}`,
  sprintStart: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/start`,
  sprintClose: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/close`,
  sprintTasks: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/tasks`,
  sprintTask: (wsId: string, boardId: string, sprintId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/tasks/${taskId}`,

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
} as const

export const pageRoutes = {
  home: '/',
  login: '/login',
  register: '/register',

  workspaces: '/workspaces',
  workspace: (id: string) => `/workspaces/${id}`,
  workspaceMembers: (id: string) => `/workspaces/${id}/members`,

  boards: (wsId: string) => `/workspaces/${wsId}/boards`,
  board: (wsId: string, boardId: string) => `/workspaces/${wsId}/boards/${boardId}`,
  boardAnalytics: (wsId: string, boardId: string) =>
    `/workspaces/${wsId}/boards/${boardId}/analytics`,
  boardSprints: (wsId: string, boardId: string) =>
    `/workspaces/${wsId}/boards/${boardId}/sprints`,
} as const

export type ApiRoutes = typeof apiRoutes
export type PageRoutes = typeof pageRoutes