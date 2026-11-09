<script setup lang="ts">
import type { QuotaFileKind } from '#shared/types/files'

const KINDS: { kind: QuotaFileKind, label: string, color: string }[] = [
  { kind: 'attachment', label: 'Вложения в задачах', color: 'bg-accent-500' },
  { kind: 'board_image', label: 'Картинки досок', color: 'bg-sky-500' },
  { kind: 'workspace_logo', label: 'Логотип', color: 'bg-emerald-500' },
]

const { current: workspace } = useSettingsWorkspace()
const usage = useStorageUsageApi(computed(() => workspace.value?.id ?? null))

const data = computed(() => usage.data.value)
const ratio = computed(() => (data.value ? data.value.usedBytes / data.value.limitBytes : 0))
const nearlyFull = computed(() => ratio.value > 0.9)
const segments = computed(() => KINDS
  .map(k => ({ ...k, bytes: data.value?.byKind[k.kind] ?? 0 }))
  .filter(k => k.bytes > 0))

function share(bytes: number): string {
  if (!data.value || !bytes) return '0%'
  return `${Math.max(0.6, (bytes / data.value.limitBytes) * 100)}%`
}
</script>

<template>
  <SettingsTile v-if="data" title="Хранилище">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="text-3xl font-semibold tracking-tight text-default">{{ formatBytes(data.usedBytes) }}</span>
      <span class="text-sm text-muted">
        из {{ formatBytes(data.limitBytes) }} на воркспейс · свободно {{ formatBytes(Math.max(0, data.limitBytes - data.usedBytes)) }}
      </span>
    </div>

    <div class="mt-4 flex h-3 overflow-hidden rounded-full bg-accented" role="img" :aria-label="`Занято ${Math.round(ratio * 100)}%`">
      <span
        v-for="s in segments"
        :key="s.kind"
        class="h-full transition-[width]"
        :class="nearlyFull ? 'bg-error' : s.color"
        :style="{ width: share(s.bytes) }"
      />
    </div>

    <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
      <li v-for="k in KINDS" :key="k.kind" class="flex items-center gap-2 text-muted">
        <span class="size-2.5 rounded-sm" :class="k.color" />
        {{ k.label }}
        <span class="text-default">{{ formatBytes(data.byKind[k.kind] ?? 0) }}</span>
      </li>
    </ul>

    <p v-if="nearlyFull" class="mt-4 rounded-xl bg-error/10 px-3 py-2 text-sm text-error">
      Место почти закончилось. Удалите ненужные вложения – новые загрузки скоро перестанут проходить.
    </p>
    <p class="mt-4 text-xs text-muted">
      Один файл – до 25 МБ. Удалённые файлы освобождают место через 7 дней. Аватары участников сюда не входят.
    </p>
  </SettingsTile>
</template>
