import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export const useWorkspaceStore = defineStore('workspace', () => {
  // Persisted in localStorage so a reload lands the user back on their
  // last-used workspace instead of forcing them to re-pick from the list.
  const currentId = useStorage<string | null>('scrumban:current-workspace', null)

  function setCurrent(id: string | null) {
    currentId.value = id
  }

  return { currentId, setCurrent }
})