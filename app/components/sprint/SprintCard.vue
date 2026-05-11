<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'

const props = defineProps<{
  sprint: Sprint
  workspaceId: string
  boardId: string
  canManage: boolean
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const { start, close, remove } = useSprintsApi(wsId, bId)

const actionError = ref<string | null>(null)

async function onStart() {
  actionError.value = null
  try {
    await start.mutateAsync(props.sprint.id)
  }
  catch (err) {
    const e = err as { statusCode?: number; data?: { message?: string } }
    if (e?.statusCode === 409) actionError.value = 'У этой доски уже есть активный спринт'
    else if (e?.statusCode === 403) actionError.value = 'У тебя нет прав запускать спринты'
    else actionError.value = e?.data?.message ?? 'Не удалось запустить спринт'
  }
}

const confirm = useConfirm()

async function onClose() {
  actionError.value = null
  const ok = await confirm({
    title: `Закрыть спринт «${props.sprint.name}»?`,
    description: 'Закрытый спринт больше нельзя запустить.',
    confirmLabel: 'Закрыть спринт',
  })
  if (!ok) return
  try {
    await close.mutateAsync(props.sprint.id)
  }
  catch (err) {
    const e = err as { statusCode?: number; data?: { message?: string } }
    actionError.value = e?.data?.message ?? 'Не удалось закрыть спринт'
  }
}

async function onRemove() {
  actionError.value = null
  const ok = await confirm({
    title: `Удалить спринт «${props.sprint.name}»?`,
    description: 'Только planned-спринты можно удалять. Действие необратимо.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(props.sprint.id)
  }
  catch (err) {
    const e = err as { statusCode?: number; data?: { message?: string } }
    if (e?.statusCode === 409) actionError.value = 'Нельзя удалить активный или закрытый спринт'
    else actionError.value = e?.data?.message ?? 'Не удалось удалить спринт'
  }
}

function formatDateRange(): string | null {
  const s = props.sprint.plannedStartAt
  const e = props.sprint.plannedEndAt
  if (!s && !e) return null
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
  if (s && e) return `${fmt(s)} → ${fmt(e)}`
  if (s) return `с ${fmt(s)}`
  if (e) return `до ${fmt(e!)}`
  return null
}
</script>

<template>
  <UCard>
    <div class="space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold truncate">{{ sprint.name }}</h3>
          <p v-if="sprint.goal" class="text-sm text-muted mt-1 line-clamp-2">{{ sprint.goal }}</p>
        </div>
        <SprintStateBadge :state="sprint.state" />
      </div>
      <div class="flex items-center gap-3 text-xs text-muted">
        <span v-if="formatDateRange()" class="flex items-center gap-1">
          <UIcon name="i-lucide-calendar" class="size-3.5" />
          {{ formatDateRange() }}
        </span>
        <span v-if="sprint.startedAt" class="flex items-center gap-1">
          <UIcon name="i-lucide-play" class="size-3.5" />
          Стартовал {{ new Date(sprint.startedAt).toLocaleDateString('ru') }}
        </span>
        <span v-if="sprint.endedAt" class="flex items-center gap-1">
          <UIcon name="i-lucide-check" class="size-3.5" />
          Закрыт {{ new Date(sprint.endedAt).toLocaleDateString('ru') }}
        </span>
      </div>
      <UAlert
        v-if="actionError"
        color="error"
        variant="soft"
        :title="actionError"
        icon="i-lucide-alert-circle"
        :close="{ onClick: () => { actionError = null } }"
      />
      <div v-if="canManage && sprint.state !== 'closed'" class="flex gap-2 pt-1">
        <UButton
          v-if="sprint.state === 'planned'"
          icon="i-lucide-play"
          size="sm"
          :loading="start.isPending.value"
          @click="onStart"
        >
          Запустить
        </UButton>
        <UButton
          v-if="sprint.state === 'active' || sprint.state === 'planned'"
          icon="i-lucide-check"
          color="neutral"
          variant="soft"
          size="sm"
          :loading="close.isPending.value"
          @click="onClose"
        >
          Закрыть
        </UButton>
        <UButton
          v-if="sprint.state === 'planned'"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="remove.isPending.value"
          class="ml-auto"
          @click="onRemove"
        />
      </div>
    </div>
  </UCard>
</template>