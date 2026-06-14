<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

defineProps<{
  workspaceId: string
  boardId: string
  taskId: string | null
}>()

const open = defineModel<boolean>('open', { default: false })
const isMobile = useMediaQuery('(max-width: 639px)')
</script>

<template>
  <UModal
    v-model:open="open"
    :fullscreen="isMobile"
    :ui="{
      content: 'p-0 sm:w-[95vw] sm:max-w-[1180px] sm:rounded-2xl',
      overlay: 'bg-black/75 backdrop-blur-sm',
    }"
  >
    <template #content>
      <TaskFocusView
        v-if="taskId"
        :workspace-id="workspaceId"
        :board-id="boardId"
        :task-id="taskId"
        @close="open = false"
      />
    </template>
  </UModal>
</template>
