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
}

const DEFAULT_DELAY = 5000

export function useDeferredAction() {
  const toast = useToast()

  function defer<T>(action: DeferredAction<T>): void {
    const ctx = action.apply()
    let cancelled = false
    const delay = action.delayMs ?? DEFAULT_DELAY

    const timer = setTimeout(() => {
      if (cancelled) return
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

    toast.add({
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
            cancelled = true
            clearTimeout(timer)
            action.rollback(ctx)
          },
        },
      ],
    })
  }

  return { defer }
}