import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = useLocalStorage('ui:sidebar-collapsed', false)
  const boardsExpanded = useLocalStorage('ui:sidebar-boards-expanded', true)
  const lastBoardView = useLocalStorage('ui:board-last-view', 'board')

  const mobileNavOpen = ref(false)
  const controlCenterOpen = ref(false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function toggleBoards() {
    boardsExpanded.value = !boardsExpanded.value
  }

  function setLastBoardView(view: string) {
    lastBoardView.value = view
  }

  function openMobileNav() { mobileNavOpen.value = true }
  function closeMobileNav() { mobileNavOpen.value = false }
  function toggleMobileNav() { mobileNavOpen.value = !mobileNavOpen.value }

  function openControlCenter() { controlCenterOpen.value = true }
  function closeControlCenter() { controlCenterOpen.value = false }

  return {
    sidebarCollapsed,
    boardsExpanded,
    lastBoardView,
    mobileNavOpen,
    controlCenterOpen,
    toggleSidebar,
    toggleBoards,
    setLastBoardView,
    openMobileNav,
    closeMobileNav,
    toggleMobileNav,
    openControlCenter,
    closeControlCenter,
  }
})