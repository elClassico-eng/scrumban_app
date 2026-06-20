<script setup lang="ts">
defineProps<{
  date: Date
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  dotClasses: string[]
  extraCount: number
  hasOverdue: boolean
}>()

const emit = defineEmits<{
  select: []
  'drop-task': [taskId: string]
}>()

const isDragOver = ref(false)

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const id = e.dataTransfer?.getData('text/task-id')
  if (id) emit('drop-task', id)
}
</script>

<template>
  <button
    type="button"
    class="relative min-h-14 sm:min-h-[4.5rem] rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors focus:outline-none"
    :class="[
      isToday ? 'bg-primary text-inverted' : 'hover:bg-elevated',
      isSelected && !isToday ? 'ring-2 ring-accent-500' : '',
      isDragOver ? 'ring-2 ring-accent-500 bg-accent-500/10' : '',
    ]"
    @click="emit('select')"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop.prevent="onDrop"
  >
    <span class="flex items-center gap-1 h-2">
      <span
        v-for="(c, i) in dotClasses"
        :key="i"
        class="size-1.5 rounded-full"
        :class="isToday ? 'bg-current opacity-80' : c"
      />
    </span>
    <span
      class="text-sm font-medium tabular-nums"
      :class="[
        !inMonth && !isToday ? 'text-dimmed' : '',
        hasOverdue && !isToday ? 'text-red-500 font-semibold' : '',
      ]"
    >
      {{ date.getDate() }}
    </span>
    <span
      v-if="extraCount > 0"
      class="absolute bottom-1 right-1.5 text-[10px] leading-none"
      :class="isToday ? 'text-inverted/70' : 'text-muted'"
    >
      +{{ extraCount }}
    </span>
  </button>
</template>
