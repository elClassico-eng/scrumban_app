<script setup lang="ts">
import { onKeyStroke, useMediaQuery, useSwipe } from '@vueuse/core'
import { MotionConfig } from 'motion-v'
import { pageRoutes } from '~/routing'
import type { SidebarItemId } from '#shared/types/sidebar'
import { SIDEBAR_ITEM_META } from '~/utils/sidebar-items'

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

const collapsed = computed(() => isDesktop.value && uiStore.sidebarCollapsed)

const changelogOpen = ref(false)
const { hasUnread: hasChangelogUnread } = useChangelog()

const { list: boardsList } = useBoardsApi(computed(() => current.value?.id ?? ''))
const activeBoardId = computed(() => (route.params.boardId as string) || null)
const canManage = computed(() => hasRole(current.value?.role, 'admin'))

const { isVisible, favorites, toggleFavorite, sortBoards, setBoardOrder } = useSidebarPrefs()
const boards = computed(() => sortBoards(boardsList.data.value?.boards ?? []))
const favoriteBoards = computed(() => boards.value.filter(b => favorites.value.has(b.id)))

const inboxBadge = useInboxBadge(computed(() => current.value?.id ?? null))
const { list: myTasksList } = useWorkspaceTasksApi(computed(() => current.value?.id ?? ''), { mine: true })

const personalLinks = computed(() => {
  const ws = current.value
  if (!ws) return []
  const openTasks = (myTasksList.data.value?.tasks ?? []).filter(t => !t.closedAt).length
  const links = [
    { id: 'inbox' as const, to: pageRoutes.workspaceInbox(ws.id), badge: inboxBadge.value, badgeTone: 'accent' as const },
    { id: 'my_tasks' as const, to: pageRoutes.workspaceMyTasks(ws.id), badge: openTasks, badgeTone: 'muted' as const },
  ]
  return links.filter(l => isVisible(l.id)).map(l => ({ ...l, ...SIDEBAR_ITEM_META[l.id] }))
})

const workspaceLinks = computed(() => {
  const ws = current.value
  if (!ws) return []
  const links: { id: SidebarItemId, to: string, exact?: boolean }[] = [
    { id: 'overview', to: pageRoutes.workspace(ws.id), exact: true },
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
  <aside
    ref="asideRef"
    :class="[
      'flex flex-col overflow-hidden border border-default bg-default text-default shadow-xl',
      'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-300 ease-out',
      uiStore.mobileNavOpen ? 'translate-x-0' : '-translate-x-[110%]',
      'lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:transition-[width] lg:my-3 lg:ml-3 lg:rounded-3xl lg:border lg:border-default lg:bg-default lg:shadow-none',
      collapsed ? 'lg:w-20' : 'lg:w-64',
    ]"
  >
    <SidebarBrand :collapsed="collapsed" :mobile="!isDesktop" @toggle="uiStore.toggleSidebar" @close="uiStore.closeMobileNav" />

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
    <nav class="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-2">
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
          @reorder="setBoardOrder"
          @toggle-favorite="toggleFavorite"
          @create="createBoardOpen = true"
        />
      </template>

      <div class="mt-auto flex flex-col gap-0.5 pt-4">
        <UTooltip v-if="isVisible('whats_new')" text="Что нового" :disabled="!collapsed" :content="{ side: 'right' }">
          <button
            type="button"
            :class="[
              'flex w-full items-center rounded-xl text-sm font-medium transition-colors duration-200',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
              'text-muted hover:bg-elevated hover:text-default',
            ]"
            @click="changelogOpen = true"
          >
            <span class="relative shrink-0">
              <UIcon :name="SIDEBAR_ITEM_META.whats_new.icon" class="size-4" />
              <span
                v-if="hasChangelogUnread"
                class="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-default"
              />
            </span>
            <span v-if="!collapsed" class="truncate">{{ SIDEBAR_ITEM_META.whats_new.label }}</span>
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
  </aside>
</template>
