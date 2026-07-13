<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const workspaceStore = useWorkspaceStore()
const workspaceId = computed(() => workspaceStore.currentId ?? null)

const { entries, markSeen } = useChangelog()

watch(open, (isOpen) => {
  if (isOpen) markSeen()
})
</script>

<template>
  <USlideover v-model:open="open" side="right" title="Что нового" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div class="-mx-4 -my-2">
        <ChangelogEntry
          v-for="e in entries"
          :key="e.path"
          :entry="e"
          :workspace-id="workspaceId"
        />
        <div v-if="entries.length === 0" class="px-4 py-12 text-center space-y-2">
          <UIcon name="i-lucide-sparkles" class="size-10 mx-auto text-muted" />
          <p class="text-sm text-muted">Пока нет записей</p>
        </div>
      </div>
    </template>
  </USlideover>
</template>
