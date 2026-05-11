import { defineStore } from 'pinia'

export const useBoardStore = defineStore('board', () => {
  // Which task drawer is currently open. Null = drawer closed.
  // Lives in the store (not local component state) so a click on a card
  // anywhere on the page can open the drawer without prop-drilling.
  const openTaskId = ref<string | null>(null)

  function openTask(id: string) {
    openTaskId.value = id
  }

  function closeTask() {
    openTaskId.value = null
  }

  return { openTaskId, openTask, closeTask }
})
