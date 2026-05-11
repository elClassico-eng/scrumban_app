import { defineStore } from 'pinia'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  // Maps to UButton's color prop on the primary action.
  confirmColor?: 'primary' | 'error' | 'warning'
}

export const useConfirmStore = defineStore('confirm', () => {
  const isOpen = ref(false)
  const opts = ref<ConfirmOptions | null>(null)
  let pendingResolve: ((v: boolean) => void) | null = null

  function request(o: ConfirmOptions): Promise<boolean> {
    opts.value = o
    isOpen.value = true
    return new Promise<boolean>((resolve) => {
      pendingResolve = resolve
    })
  }

  function resolve(value: boolean) {
    pendingResolve?.(value)
    pendingResolve = null
    isOpen.value = false
  }

  // Modal dismissal (X button, click outside, Esc) sets isOpen to false
  // without going through `resolve`. Treat that as a "cancel".
  watch(isOpen, (v) => {
    if (!v && pendingResolve) {
      pendingResolve(false)
      pendingResolve = null
    }
  })

  return { isOpen, opts, request, resolve }
})