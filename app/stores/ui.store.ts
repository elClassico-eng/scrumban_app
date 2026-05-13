import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = useLocalStorage('ui:sidebar-collapsed', false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return { sidebarCollapsed, toggleSidebar }
})