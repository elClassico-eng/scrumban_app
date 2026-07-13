<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
  boardId: string
  hasActiveSprint: boolean
}>()

const route = useRoute()
const router = useRouter()

function openTask(taskId: string) {
  router.push({ path: route.path, query: { ...route.query, task: taskId } })
}

const { digest } = useDailyDigestApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
  computed(() => props.hasActiveSprint),
)

const d = computed(() => digest.data.value ?? null)

type Item = { icon: string; tone: string; text: string; taskId?: string }

const items = computed<Item[]>(() => {
  if (!d.value) return []
  const out: Item[] = []
  for (const b of d.value.blockers.slice(0, 3)) {
    out.push({ icon: 'i-lucide-octagon-x', tone: 'text-red-500', text: `«${b.title}» ${b.blockedDays} дн в блоке`, taskId: b.taskId })
  }
  for (const a of d.value.aging.slice(0, 3)) {
    out.push({ icon: 'i-lucide-hourglass', tone: 'text-accent-600', text: `«${a.title}» старше P85 на ${a.overP85Days} дн`, taskId: a.taskId })
  }
  if (d.value.sprintRisk) {
    for (const r of d.value.sprintRisk.atRisk.slice(0, 2)) {
      out.push({ icon: 'i-lucide-flag-triangle-right', tone: 'text-accent-600', text: `«${r.title}» рискует не успеть`, taskId: r.taskId })
    }
  }
  const seen = new Set<string>()
  return out.filter((i) => {
    const key = i.text
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 6)
})
</script>

<template>
  <section v-if="hasActiveSprint" class="space-y-2.5">
    <h3 class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted m-0">
      Требует внимания
    </h3>

    <div v-if="items.length === 0" class="flex items-center gap-2 text-[12.5px] text-emerald-600 dark:text-emerald-400">
      <UIcon name="i-lucide-check-circle-2" class="size-4" />
      Всё под контролем
    </div>

    <ul v-else class="space-y-1 m-0 p-0 list-none">
      <li v-for="(i, idx) in items" :key="idx">
        <button
          v-if="i.taskId"
          type="button"
          class="w-full flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 text-left hover:bg-elevated/60 cursor-pointer transition-colors"
          @click="openTask(i.taskId)"
        >
          <UIcon :name="i.icon" class="size-3.5 shrink-0 mt-0.5" :class="i.tone" />
          <span class="flex-1 min-w-0 text-[12.5px] leading-snug text-default">{{ i.text }}</span>
        </button>
        <div v-else class="flex items-start gap-2 px-2 py-1.5 -mx-2">
          <UIcon :name="i.icon" class="size-3.5 shrink-0 mt-0.5" :class="i.tone" />
          <span class="flex-1 min-w-0 text-[12.5px] leading-snug text-default">{{ i.text }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>
