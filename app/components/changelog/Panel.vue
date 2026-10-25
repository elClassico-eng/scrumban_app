<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const open = defineModel<boolean>('open', { required: true })

const workspaceStore = useWorkspaceStore()
const workspaceId = computed(() => workspaceStore.currentId ?? null)
const isMobile = useMediaQuery('(max-width: 767px)')

const { entries, markSeen } = useChangelog()
const activePath = ref<string | null>(null)
const active = computed(() => entries.value.find(e => e.path === activePath.value) ?? entries.value[0] ?? null)

watch(open, (isOpen) => {
  if (!isOpen) return
  activePath.value = entries.value[0]?.path ?? null
  markSeen()
})

function navTitle(title: string) {
  const rest = title.replace(/^Релиз [\d.]+:\s*/, '')
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(iso))
}
</script>

<template>
  <UModal
    v-model:open="open"
    :fullscreen="isMobile"
    title="Что нового"
    :ui="{ content: 'sm:max-w-5xl', body: 'p-0 sm:p-0' }"
  >
    <template #body>
      <div v-if="entries.length" class="grid md:h-[min(760px,82vh)] md:grid-cols-[220px_1fr]">
        <nav class="flex gap-1 overflow-x-auto border-b border-default p-2 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r" aria-label="Релизы и обновления">
          <button
            v-for="e in entries"
            :key="e.path"
            type="button"
            :class="[
              'shrink-0 cursor-pointer rounded-xl px-3 py-2 text-left transition-colors md:w-full',
              e.path === active?.path ? 'bg-elevated' : 'hover:bg-elevated/60',
            ]"
            @click="activePath = e.path"
          >
            <span class="flex items-center gap-1.5 text-[11px] text-dimmed">
              <span v-if="e.version" class="rounded-md bg-accent-500/15 px-1.5 font-semibold text-accent-600 dark:text-accent-400">{{ e.version }}</span>
              {{ shortDate(e.date) }}
            </span>
            <span :class="['mt-0.5 block truncate text-[13px]', e.path === active?.path ? 'font-semibold text-highlighted' : 'text-default']">
              {{ navTitle(e.title) }}
            </span>
          </button>
        </nav>
        <div class="min-h-0 overflow-y-auto">
          <ChangelogEntry v-if="active" :key="active.path" :entry="active" :workspace-id="workspaceId" @navigate="open = false" />
        </div>
      </div>
      <div v-else class="space-y-2 px-4 py-16 text-center">
        <UIcon name="i-hugeicons-sparkles" class="mx-auto size-10 text-muted" />
        <p class="text-sm text-muted">Пока нет записей</p>
      </div>
    </template>
  </UModal>
</template>
