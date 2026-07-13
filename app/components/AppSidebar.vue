<script setup lang="ts">
import { onKeyStroke, useMediaQuery, useSwipe } from '@vueuse/core'
import { pageRoutes } from '~/routing'

const workspaceStore = useWorkspaceStore()
const uiStore = useUiStore()
const route = useRoute()
const { list } = useWorkspacesApi()

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

const workspaces = computed(() => list.data.value?.workspaces ?? [])
const current = computed(() => {
  const id = workspaceStore.currentId
  return workspaces.value.find(w => w.id === id) ?? workspaces.value[0] ?? null
})

const collapsed = computed(() => isDesktop.value && uiStore.sidebarCollapsed)

const { list: boardsList } = useBoardsApi(computed(() => current.value?.id ?? ''))
const boards = computed(() => boardsList.data.value?.boards ?? [])
const activeBoardId = computed(() => (route.params.boardId as string) || null)

const workspaceLinks = computed(() => {
  if (!current.value) return []
  return [
    { label: 'Участники', icon: 'i-lucide-users', to: pageRoutes.workspaceMembers(current.value.id) },
    { label: 'Активность', icon: 'i-lucide-activity', to: pageRoutes.workspaceActivity(current.value.id) },
    { label: 'Отчёты', icon: 'i-lucide-clipboard-list', to: pageRoutes.workspaceReports(current.value.id) },
    { label: 'Симулятор', icon: 'i-lucide-flask-conical', to: pageRoutes.workspaceSimulator(current.value.id) },
  ]
})

const manageLinks = computed(() => {
  if (!current.value || !hasRole(current.value.role, 'admin')) return []
  return [
    { label: 'Настройки', icon: 'i-lucide-settings', to: pageRoutes.workspaceSettings(current.value.id) },
  ]
})
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
      'lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:transition-[width] lg:border-0 lg:bg-transparent lg:shadow-none lg:pt-3',
      collapsed ? 'lg:w-20' : 'lg:w-64 lg:pl-3',
    ]"
  >
    <SidebarBrand :collapsed="collapsed" :mobile="!isDesktop" @toggle="uiStore.toggleSidebar" @close="uiStore.closeMobileNav" />

    <Transition
      enter-active-class="transition-opacity duration-200 delay-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <WorkspaceSwitcher v-if="!collapsed" />
    </Transition>
    <div v-if="collapsed" class="mx-3 my-2 border-t border-default" />

    <nav class="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-2">
      <SidebarNavItem
        :to="pageRoutes.workspaces"
        icon="i-lucide-layout-grid"
        label="Все workspaces"
        :collapsed="collapsed"
        exact
      />

      <template v-if="current">
        <SidebarSectionLabel label="Рабочее пространство" :collapsed="collapsed" />
        <div class="flex flex-col gap-1">
          <SidebarNavItem
            :to="pageRoutes.workspace(current.id)"
            icon="i-lucide-house"
            label="Обзор"
            :collapsed="collapsed"
            exact
          />
          <SidebarBoardsGroup
            :workspace-id="current.id"
            :boards="boards"
            :active-board-id="activeBoardId"
            :collapsed="collapsed"
            :expanded="uiStore.boardsExpanded"
            @toggle="uiStore.toggleBoards"
          />
          <SidebarNavItem
            v-for="link in workspaceLinks"
            :key="link.label"
            :to="link.to"
            :icon="link.icon"
            :label="link.label"
            :collapsed="collapsed"
          />
        </div>

        <template v-if="manageLinks.length">
          <SidebarSectionLabel label="Управление" :collapsed="collapsed" />
          <div class="flex flex-col gap-1">
            <SidebarNavItem
              v-for="link in manageLinks"
              :key="link.label"
              :to="link.to"
              :icon="link.icon"
              :label="link.label"
              :collapsed="collapsed"
            />
          </div>
        </template>
      </template>

      <div class="mt-auto pt-2">
        <SidebarNavItem
          to="/docs"
          icon="i-lucide-book-open"
          label="Документация"
          :collapsed="collapsed"
          external
        />
      </div>
    </nav>

    <SidebarUserCard :collapsed="collapsed" />
  </aside>
</template>
