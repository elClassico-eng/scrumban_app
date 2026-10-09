import type { InjectionKey, Ref } from 'vue'
import type { RouteTarget } from '~/utils/notification-render'

export type IslandTimerCtx = {
  taskId: Ref<string>
  taskTitle: Ref<string>
  seconds: Ref<number>
  running: Ref<boolean>
  active: Ref<boolean>
  onToggle: (e: Event) => void
  onStop: (e: Event) => void
}

export type IslandPerson = { id: string; name: string; color: string; initials: string; avatarUrl?: string | null }

export type IslandPresenceCtx = {
  people: Ref<IslandPerson[]>
  extra: Ref<number>
  onViewAll: (e: Event) => void
}

export type IslandReplenishmentCtx = {
  canMark: Ref<boolean>
  onMark: (e: Event) => void
}

export type IslandNavigate = (target: RouteTarget) => void

export const islandTimerKey: InjectionKey<IslandTimerCtx> = Symbol('islandTimer')
export const islandPresenceKey: InjectionKey<IslandPresenceCtx> = Symbol('islandPresence')
export const islandReplenishmentKey: InjectionKey<IslandReplenishmentCtx> = Symbol('islandReplenishment')
export const islandNavigateKey: InjectionKey<IslandNavigate> = Symbol('islandNavigate')
export const islandWorkspaceKey: InjectionKey<Ref<string>> = Symbol('islandWorkspace')
