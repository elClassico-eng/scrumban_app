<script setup lang="ts">
const props = defineProps<{ workspaceId: string, botName: string }>()

const { list } = useBoardsApi(computed(() => props.workspaceId))
const boards = computed(() => list.data.value?.boards ?? [])
</script>

<template>
  <div class="space-y-4">
    <p class="px-1 text-sm text-muted">
      Сначала добавьте бота «{{ botName }}» в нужный чат в Пачке – бот видит только чаты, где он состоит.
    </p>
    <SettingsTile v-for="b in boards" :key="b.id" :title="b.name">
      <BoardPachcaFeedSection :workspace-id="workspaceId" :board-id="b.id" />
    </SettingsTile>
    <SettingsTile v-if="!boards.length && !list.isLoading.value">
      <p class="text-sm text-muted">Сначала создайте доску – ленты привязываются к доскам.</p>
    </SettingsTile>
  </div>
</template>
