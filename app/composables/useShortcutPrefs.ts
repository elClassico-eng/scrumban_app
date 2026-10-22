import { useQueryClient } from '@tanstack/vue-query'
import type { ShortcutId, ShortcutPrefs } from '#shared/types/shortcuts'
import { effectiveCombos } from '~/utils/shortcuts'

export function useShortcutPrefs() {
  const { me, update } = useProfileApi()
  const qc = useQueryClient()
  const toast = useToast()

  const prefs = computed<ShortcutPrefs>(() => me.data.value?.user.shortcutPrefs ?? {})
  const combos = computed(() => effectiveCombos(prefs.value))

  function save(next: ShortcutPrefs) {
    const prev = me.data.value
    if (prev) qc.setQueryData(['users', 'me'], { user: { ...prev.user, shortcutPrefs: next } })
    update.mutate({ shortcutPrefs: next }, {
      onError: () => {
        if (prev) qc.setQueryData(['users', 'me'], prev)
        toast.add({ title: 'Не удалось сохранить сочетание', color: 'error', icon: 'i-hugeicons-alert-circle' })
      },
    })
  }

  function setCombo(id: ShortcutId, combo: string | null) {
    const { [id]: _drop, ...rest } = prefs.value
    save(combo ? { ...rest, [id]: combo } : rest)
  }

  return { prefs, combos, setCombo, resetAll: () => save({}) }
}
