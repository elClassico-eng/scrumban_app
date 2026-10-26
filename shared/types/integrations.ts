import type { InstantNotificationType } from './notification'

export const FEED_EVENTS = ['task_closed', 'task_reopened', 'task_blocked', 'task_created', 'sprint_started', 'sprint_closed'] as const
export type FeedEvent = (typeof FEED_EVENTS)[number]
export const DEFAULT_FEED_EVENTS: FeedEvent[] = ['task_closed', 'task_reopened', 'task_blocked', 'sprint_started', 'sprint_closed']

export type IntegrationStatus = 'active' | 'error'

export type PachcaIntegrationView = {
  status: IntegrationStatus
  botName: string
  tokenHint: string
  emailsVisible: boolean
  linkPreviews: boolean
  webhookUrl: string
  lastError: string | null
}

export type PachcaLinkView = {
  displayName: string
  instantTypes: InstantNotificationType[]
  digest: boolean
}

export type PachcaStateResponse = {
  available: boolean
  canManage: boolean
  integration: PachcaIntegrationView | null
  me: PachcaLinkView | null
}

export type PachcaCandidate = {
  id: string
  name: string
  nickname: string
  emailMatches: boolean
}

export type PachcaChat = { id: string, name: string }

export type PachcaInviteResult = {
  members: number
  matched: number
  alreadyLinked: number
  sent: number
}

export type PachcaLinkInspect =
  | { valid: true, workspaceName: string, pachcaName: string }
  | { valid: false, reason: 'not_found' | 'expired' | 'used' | 'other_user' }

export type BoardFeedView = {
  id: string
  chatId: string
  chatName: string
  events: FeedEvent[]
  standupTime: string | null
  status: IntegrationStatus
}
