import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = useLocalStorage('ui:sidebar-collapsed', false)
  const lastBoardView = useLocalStorage('ui:board-last-view', 'board')

  const mobileNavOpen = ref(false)
  const controlCenterOpen = ref(false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
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
    lastBoardView,
    mobileNavOpen,
    controlCenterOpen,
    toggleSidebar,
    setLastBoardView,
    openMobileNav,
    closeMobileNav,
    toggleMobileNav,
    openControlCenter,
    closeControlCenter,
  }
})