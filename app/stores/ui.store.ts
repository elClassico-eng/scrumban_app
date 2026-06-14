import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = useLocalStorage('ui:sidebar-collapsed', false)
  const boardsExpanded = useLocalStorage('ui:sidebar-boards-expanded', true)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function toggleBoards() {
    boardsExpanded.value = !boardsExpanded.value
  }

  return { sidebarCollapsed, boardsExpanded, toggleSidebar, toggleBoards }
})