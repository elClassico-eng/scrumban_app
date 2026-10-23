<script setup lang="ts">
import { onKeyStroke, useMediaQuery, useSwipe } from '@vueuse/core'
import { MotionConfig } from 'motion-v'
import { pageRoutes } from '~/routing'
import type { SidebarItemId } from '#shared/types/sidebar'
import { SIDEBAR_ITEM_META, SIDEBAR_ROW, sidebarFade } from '~/utils/sidebar-items'

const uiStore = useUiStore()
const route = useRoute()
const { current } = useCurrentWorkspace()

const isDesktop = useMediaQuery('(min-width: 1024px)')
const asideRef = ref<HTMLElement | null>(null)

watch(() => route.fullPath, () => uiStore.closeMobileNav())

onKeyStroke('Escape', () => {
  if (uiStore.mobileNavOpen) uiStore.closeMobileNav()
})

useSwipe(asideRef, {
  onSwipeEnd: (_e, direction) => {
    if (direction === 'left' && uiStore.mobileNavOpen) uiStore.closeMobileNav()
  },
})

const rail = computed(() => isDesktop.value && uiStore.sidebarCollapsed)
const peekRequested = ref(false)
const peek = computed(() => rail.value && peekRequested.value)
const collapsed = computed(() => rail.value && !peekRequested.value)
let peekTimer: ReturnType<typeof setTimeout> | undefined

watch(() => uiStore.sidebarCollapsed, () => {
  clearTimeout(peekTimer)
  peekRequested.value = false
})

function startPeek(delay: number) {
  if (!rail.value) return
  clearTimeout(peekTimer)
  peekTimer = setTimeout(() => { peekRequested.value = true }, delay)
}

// Menus opened from the rail render outside it, so leaving the rail toward a
// menu must not fold it; wait until the menu closes and the pointer is gone.
function endPeek() {
  clearTimeout(peekTimer)
  peekTimer = setTimeout(function tryHide() {
    const el = asideRef.value
    if (el?.matches(':hover') || el?.querySelector(':focus-visible')) return
    if (el?.querySelector('[aria-expanded="true"]')) {
      peekTimer = setTimeout(tryHide, 300)
      return
    }
    peekRequested.value = false
  }, 80)
}

onBeforeUnmount(() => clearTimeout(peekTimer))

const changelogOpen = ref(false)
const { hasUnread: hasChangelogUnread } = useChangelog()

const { list: boardsList } = useBoardsApi(computed(() => current.value?.id ?? ''))
const activeBoardId = computed(() => (route.params.boardId as string) || null)
const canManage = computed(() => hasRole(current.value?.role, 'admin'))
const archivedBoards = useArchivedBoards(computed(() => current.value?.id ?? ''), canManage)
const archivedCount = computed(() => archivedBoards.data.value?.boards.length ?? 0)

const { isVisible, favorites, frame, toggleFavorite, sortBoards, setBoardOrder } = useSidebarPrefs()
const { combos } = useShortcutPrefs()
const help = useHelpPanel()
const boards = computed(() => sortBoards(boardsList.data.value?.boards ?? []))
const favoriteBoards = computed(() => boards.value.filter(b => favorites.value.has(b.id)))

const inboxBadge = useInboxBadge(computed(() => current.value?.id ?? null))
const { list: myTasksList } = useWorkspaceTasksApi(computed(() => current.value?.id ?? ''), { mine: true })

const personalLinks = computed(() => {
  const ws = current.value
  if (!ws) return []
  const openTasks = (myTasksList.data.value?.tasks ?? []).filter(t => !t.closedAt).length
  const links = [
    { id: 'inbox' as const, to: pageRoutes.workspaceInbox(ws.id), badge: inboxBadge.value, badgeTone: 'accent' as const, combo: combos.value.go_inbox },
    { id: 'my_tasks' as const, to: pageRoutes.workspaceMyTasks(ws.id), badge: openTasks, badgeTone: 'muted' as const, combo: combos.value.go_my_tasks },
  ]
  return links.filter(l => isVisible(l.id)).map(l => ({ ...l, ...SIDEBAR_ITEM_META[l.id] }))
})

const workspaceLinks = computed(() => {
  const ws = current.value
  if (!ws) return []
  const links: { id: SidebarItemId, to: string, exact?: boolean, combo?: string }[] = [
    { id: 'overview', to: pageRoutes.workspace(ws.id), exact: true, combo: combos.value.go_overview },
    { id: 'activity', to: pageRoutes.workspaceActivity(ws.id) },
    { id: 'reports', to: pageRoutes.workspaceReports(ws.id) },
    { id: 'simulator', to: pageRoutes.workspaceSimulator(ws.id) },
  ]
  return links.filter(l => isVisible(l.id)).map(l => ({ ...l, ...SIDEBAR_ITEM_META[l.id] }))
})

const createBoardOpen = ref(false)
const inviteOpen = ref(false)
const customizeOpen = ref(false)
</script>

<template>
  <div
    v-show="uiStore.mobileNavOpen"
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
    @click="uiStore.closeMobileNav"
  />
  <div :class="rail ? 'relative w-14 shrink-0' : 'contents'">
  <aside
    ref="asideRef"
    :class="[
      'flex flex-col overflow-hidden border border-default bg-default text-default shadow-xl',
      { dark: frame === 'dark' },
      'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-300 ease-out',
      uiStore.mobileNavOpen ? 'translate-x-0' : '-translate-x-[110%]',
      'lg:max-w-none lg:translate-x-0 lg:border-0 lg:transition-[width,box-shadow]',
      collapsed ? 'lg:duration-150 lg:ease-[cubic-bezier(0.4,0,1,1)]' : 'lg:duration-[220ms] lg:ease-[cubic-bezier(0.32,0.72,0,1)]',
      rail ? 'lg:absolute lg:inset-y-0 lg:left-0 lg:z-40' : 'lg:static lg:z-auto',
      collapsed ? 'lg:w-14' : 'lg:w-64',
      'lg:bg-[var(--frame-bg)]',
      peek ? 'lg:shadow-2xl lg:shadow-black/30' : 'lg:shadow-none',
    ]"
    @mouseenter="startPeek(150)"
    @mouseleave="endPeek"
    @focusin="startPeek(0)"
    @focusout="endPeek"
  >
    <SidebarBrand :collapsed="collapsed" :peek="peek" :mobile="!isDesktop" @toggle="uiStore.toggleSidebar" @close="uiStore.closeMobileNav" />

    <WorkspaceSwitcher :collapsed="collapsed" @invite="inviteOpen = true" @customize="customizeOpen = true" />

    <SidebarQuickBar
      v-if="current"
      :workspace-id="current.id"
      :boards="boards"
      :can-manage="canManage"
      :collapsed="collapsed"
      @create-board="createBoardOpen = true"
      @invite="inviteOpen = true"
    />

    <MotionConfig reduced-motion="user">
    <nav class="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 py-2">
      <template v-if="current">
        <div v-if="personalLinks.length" class="flex flex-col gap-0.5 pt-1">
          <SidebarNavItem
            v-for="link in personalLinks"
            :key="link.id"
            :to="link.to"
            :icon="link.icon"
            :label="link.label"
            :collapsed="collapsed"
            :badge="link.badge"
            :badge-tone="link.badgeTone"
            :combo="link.combo"
          />
        </div>

        <template v-if="workspaceLinks.length">
          <SidebarSectionLabel label="Рабочее пространство" :collapsed="collapsed" />
          <div class="flex flex-col gap-0.5">
            <SidebarNavItem
              v-for="link in workspaceLinks"
              :key="link.id"
              :to="link.to"
              :icon="link.icon"
              :label="link.label"
              :collapsed="collapsed"
              :exact="link.exact"
              :combo="link.combo"
            />
          </div>
        </template>

        <template v-if="isVisible('favorites') && favoriteBoards.length">
          <SidebarSectionLabel label="Избранное" :collapsed="collapsed" />
          <div class="flex flex-col gap-0.5">
            <SidebarBoardLink
              v-for="b in favoriteBoards"
              :key="b.id"
              :workspace-id="current.id"
              :board="b"
              :active="activeBoardId === b.id"
              favorite
              indicator="sidebar-active-favorite"
              :collapsed="collapsed"
              @toggle-favorite="toggleFavorite(b.id)"
            />
          </div>
        </template>

        <SidebarBoardsSection
          :workspace-id="current.id"
          :boards="boards"
          :active-board-id="activeBoardId"
          :favorites="favorites"
          :collapsed="collapsed"
          :can-create="canManage"
          :archived-count="archivedCount"
          @reorder="setBoardOrder"
          @toggle-favorite="toggleFavorite"
          @create="createBoardOpen = true"
        />
      </template>

      <div class="mt-auto flex flex-col gap-0.5 pt-4">
        <UTooltip v-if="isVisible('whats_new')" text="Что нового" :disabled="!collapsed" :content="{ side: 'right' }">
          <button
            type="button"
:class="[SIDEBAR_ROW, 'cursor-pointer pl-3 pr-2.5 text-muted hover:bg-elevated hover:text-default']"
            @click="changelogOpen = true"
          >
            <span class="relative shrink-0">
              <UIcon :name="SIDEBAR_ITEM_META.whats_new.icon" class="size-4" />
              <span
                v-if="hasChangelogUnread"
                class="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-default"
              />
            </span>
            <span :class="['truncate', sidebarFade(collapsed)]">{{ SIDEBAR_ITEM_META.whats_new.label }}</span>
          </button>
        </UTooltip>
        <UTooltip v-if="isVisible('help')" :disabled="!collapsed" :content="{ side: 'right' }" text="Справка">
          <button
            type="button"
:class="[SIDEBAR_ROW, 'cursor-pointer pl-3 pr-2.5 text-muted hover:bg-elevated hover:text-default']"
            @click="help.show('page')"
          >
            <UIcon :name="SIDEBAR_ITEM_META.help.icon" class="size-4 shrink-0" />
            <span :class="['flex-1 truncate text-left', sidebarFade(collapsed)]">{{ SIDEBAR_ITEM_META.help.label }}</span>
            <UKbd value="?" size="sm" :class="sidebarFade(collapsed)" />
          </button>
        </UTooltip>
        <SidebarNavItem
          v-if="isVisible('docs')"
          to="/docs"
          :icon="SIDEBAR_ITEM_META.docs.icon"
          :label="SIDEBAR_ITEM_META.docs.label"
          :collapsed="collapsed"
          external
        />
      </div>
    </nav>
    </MotionConfig>

    <SidebarUserCard :collapsed="collapsed" />
    <ChangelogPanel v-model:open="changelogOpen" />
    <SidebarCustomizeModal v-model:open="customizeOpen" />
    <template v-if="current && canManage">
      <BoardCreateModal v-model:open="createBoardOpen" :workspace-id="current.id" />
      <WorkspaceInviteModal v-model:open="inviteOpen" :workspace-id="current.id" :workspace-name="current.name" />
    </template>
    <template v-if="current">
      <BoardEditModal :workspace-id="current.id" />
      <BoardDeleteModal :workspace-id="current.id" />
    </template>
  </aside>
  </div>
</template>
