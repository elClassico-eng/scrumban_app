import type { Ref } from 'vue'

type PausedTask = { boardId: string; taskId: string; shortId: string; title: string }

export function useIslandTimer(workspaceId: Ref<string>) {
  const { list: activeTimer } = useActiveTimerApi(workspaceId)
  const active = computed(() => activeTimer.data.value?.active ?? null)
  const paused = ref<PausedTask | null>(null)

  const running = computed(() => active.value !== null)
  const hasTask = computed(() => running.value || paused.value !== null)
  const currentBoardId = computed(() => active.value?.boardId ?? paused.value?.boardId ?? '')
  const currentTaskId = computed(() => active.value?.entry.taskId ?? paused.value?.taskId ?? '')
  const timerTaskId = computed(() => active.value?.taskShortId ?? paused.value?.shortId ?? '')
  const timerTaskTitle = computed(() => active.value?.taskTitle ?? paused.value?.title ?? '')

  const { start: startTimerMut, stop: stopTimerMut } = useTaskTimeApi(workspaceId, currentBoardId, currentTaskId)

  const elapsed = ref(0)
  const sessionBase = ref(0)
  let sessionTaskId = ''
  let tick: ReturnType<typeof setInterval> | null = null

  function stopTick() {
    if (tick) {
      clearInterval(tick)
      tick = null
    }
  }

  function startTick() {
    stopTick()
    tick = setInterval(() => { elapsed.value++ }, 1000)
  }

  watch(active, (a) => {
    if (a) {
      paused.value = null
      if (a.entry.taskId !== sessionTaskId) {
        sessionTaskId = a.entry.taskId
        sessionBase.value = 0
      }
      elapsed.value = sessionBase.value + a.entry.elapsedSeconds
      startTick()
    }
    else {
      stopTick()
    }
  }, { immediate: true })

  function onToggle(e: Event) {
    e.stopPropagation()
    if (running.value) {
      const a = active.value
      if (!a) return
      stopTick()
      sessionBase.value = elapsed.value
      paused.value = { boardId: a.boardId, taskId: a.entry.taskId, shortId: a.taskShortId, title: a.taskTitle }
      stopTimerMut.mutate()
    }
    else if (paused.value) {
      startTimerMut.mutate()
    }
  }

  function onStop(e: Event) {
    e.stopPropagation()
    if (running.value) stopTimerMut.mutate()
    paused.value = null
    sessionBase.value = 0
    sessionTaskId = ''
    elapsed.value = 0
  }

  onUnmounted(stopTick)

  return { running, hasTask, timerTaskId, timerTaskTitle, elapsed, currentBoardId, currentTaskId, onToggle, onStop }
}
