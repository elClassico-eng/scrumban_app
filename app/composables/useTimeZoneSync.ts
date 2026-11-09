import { shouldSyncZone } from '#shared/utils/local-time'

export function useTimeZoneSync() {
  const { me, update } = useProfileApi()
  watch(() => me.data.value?.user, (user) => {
    if (!user) return
    const key = `scrumban:tz-synced:${user.id}`
    try {
      const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (shouldSyncZone({ userZone: user.timeZone, browserZone, synced: !!localStorage.getItem(key) })) {
        update.mutate({ timeZone: browserZone })
      }
      localStorage.setItem(key, '1')
    }
    catch {
      // Storage blocked: skip the one-off sync, the zone can be picked by hand.
    }
  }, { immediate: true })
}
