const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function useClock() {
  const now = ref(new Date())

  const time = computed(() => `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`)
  const weekday = computed(() => WEEKDAYS[now.value.getDay()] as string)

  let clockTimer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  })

  onUnmounted(() => {
    if (clockTimer) clearInterval(clockTimer)
  })

  return { now, time, weekday }
}
