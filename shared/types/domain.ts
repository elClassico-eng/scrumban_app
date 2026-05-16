export type Role = 'viewer' | 'member' | 'scrum_master' | 'admin' | 'owner'

export type SprintState = 'planned' | 'active' | 'closed'

export type ServiceClass = 'expedite' | 'fixed_date' | 'standard' | 'intangible'

export type TaskEventType =
  | 'task_created'
  | 'task_moved'
  | 'task_closed'
  | 'task_reopened'
  | 'task_assigned'
  | 'task_updated'
  | 'task_archived'
  | 'task_commented'
  | 'task_comment_deleted'
