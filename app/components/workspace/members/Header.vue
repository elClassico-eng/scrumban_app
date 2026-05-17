<script setup lang="ts">
defineProps<{
  workspaceName: string
  workspaceSlug?: string
  totalCount: number
  canInvite: boolean
}>()

const emit = defineEmits<{ invite: [] }>()

function workspaceMark(name: string): string {
  return name.charAt(0).toUpperCase()
}
</script>

<template>
  <header class="flex items-end justify-between gap-4 flex-wrap">
    <div class="space-y-2 min-w-0">
      <h1 class="text-2xl font-bold tracking-tight text-default flex items-baseline gap-2">
        Участники
        <span class="text-base font-medium text-muted">· {{ totalCount }}</span>
      </h1>
      <div class="flex items-center gap-2 text-xs text-muted">
        <span>Workspace:</span>
        <span class="inline-flex items-center gap-1.5 rounded-md border border-default bg-default px-2 py-1 text-default font-medium">
          <span class="inline-flex items-center justify-center size-4 rounded bg-primary text-inverted text-[10px] font-bold">
            {{ workspaceMark(workspaceName) }}
          </span>
          {{ workspaceName }}
        </span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <UButton
        v-if="canInvite"
        icon="i-lucide-mail-plus"
        size="md"
        @click="emit('invite')"
      >
        Пригласить
      </UButton>
    </div>
  </header>
</template>
