export interface DeferredAction<T> {
  toast: {
    title: string
    description?: string
    icon?: string
  }
  apply: () => T
  commit: () => Promise<unknown>
  rollback: (ctx: T) => void
  onCommitError?: (err: unknown, ctx: T) => void
  delayMs?: number
  coalesceKey?: string
}

interface PendingState {
  cancelled: { value: boolean }
  timer: ReturnType<typeof setTimeout>
  toastId: string | number
  ctx: unknown
}

const DEFAULT_DELAY = 5000
const pending = new Map<string, PendingState>()

export function useDeferredAction() {
  const toast = useToast()

  function defer<T>(action: DeferredAction<T>): void {
    const key = action.coalesceKey
    const existing = key ? pending.get(key) : undefined

    const newCtx = action.apply()
    const ctx: T = existing ? (existing.ctx as T) : newCtx

    if (existing) {
      clearTimeout(existing.timer)
      existing.cancelled.value = true
      try { toast.remove(existing.toastId) }
      catch { /* toast already auto-dismissed */ }
    }

    const cancelled = { value: false }
    const delay = action.delayMs ?? DEFAULT_DELAY

    const timer = setTimeout(() => {
      if (cancelled.value) return
      if (key) pending.delete(key)
      action.commit().catch((err) => {
        action.rollback(ctx)
        if (action.onCommitError) action.onCommitError(err, ctx)
        else {
          toast.add({
            title: 'Не удалось сохранить',
            description: getErrorMessage(err, 'Попробуй ещё раз'),
            color: 'error',
            icon: 'i-lucide-alert-circle',
          })
        }
      })
    }, delay)

    const t = toast.add({
      title: action.toast.title,
      description: action.toast.description,
      icon: action.toast.icon ?? 'i-lucide-undo-2',
      duration: delay,
      actions: [
        {
          label: 'Отменить',
          color: 'neutral',
          variant: 'outline',
          onClick: () => {
            if (cancelled.value) return
            cancelled.value = true
            clearTimeout(timer)
            action.rollback(ctx)
            if (key) pending.delete(key)
          },
        },
      ],
    })

    if (key) {
      pending.set(key, {
        cancelled,
        timer,
        toastId: t.id,
        ctx: ctx as unknown,
      })
    }
  }

  return { defer }
}
