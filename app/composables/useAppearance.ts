import { useDebounceFn } from '@vueuse/core'
import { DEFAULT_APPEARANCE, type AppearancePrefs } from '#shared/types/appearance'

export const APPEARANCE_STORAGE_KEY = 'scrumban:appearance'
const MANAGED_CLASSES = ['takt-bg', 'takt-compact', 'takt-reduce-motion']
const MANAGED_VARS = ['--takt-bg-image', '--takt-bg-dim', '--takt-bg-blur']

function applyToDocument(p: AppearancePrefs) {
  const css = appearanceVars(p)
  const root = document.documentElement
  root.classList.remove(...MANAGED_CLASSES)
  root.classList.add(...css.classes)
  for (const name of MANAGED_VARS) root.style.removeProperty(name)
  for (const [name, value] of Object.entries(css.vars)) root.style.setProperty(name, value)
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(css))
  }
  catch {
    // Storage blocked: the early script just won't pre-paint the background next time.
  }
}

export function useAppearance() {
  const { me, update } = useProfileApi()
  const local = useState<AppearancePrefs | null>('appearance-local', () => null)
  const known = computed(() => resolveAppearance(me.data.value?.user.appearancePrefs, local.value))
  const prefs = computed<Required<AppearancePrefs>>(() => known.value ?? DEFAULT_APPEARANCE)

  const pending = useState<AppearancePrefs>('appearance-pending', () => ({}))
  const flush = useDebounceFn(() => {
    const patch = pending.value
    pending.value = {}
    update.mutate({ appearancePrefs: patch }, { onSuccess: () => { if (!Object.keys(pending.value).length) local.value = null } })
  }, 400)
  function persist(patch: AppearancePrefs) {
    pending.value = { ...pending.value, ...patch }
    return flush()
  }

  function set(patch: AppearancePrefs) {
    local.value = { ...local.value, ...patch }
    void persist(patch)
  }

  return { prefs, known, set }
}

export function useAppearanceSync() {
  const { known } = useAppearance()
  const mounted = useMounted()
  watch([known, mounted], ([p, m]) => {
    if (m && p) applyToDocument(p)
  }, { immediate: true, deep: true })
}
