<script setup lang="ts">
defineProps<{
  taskId: string
  taskTitle: string
  seconds: number
  running: boolean
}>()

defineEmits<{
  toggle: [e: Event]
  stop: [e: Event]
}>()

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function timerStr(seconds: number) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
}
</script>

<template>
  <div
    class="rounded-2xl p-[13px]"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)] mb-[9px]">Активная задача</div>
    <div class="font-mono text-[11px] text-[var(--island-orange-2)]">{{ taskId }} · в работе</div>
    <div class="text-[13.5px] font-medium leading-[1.3] mt-[3px] mb-3 text-[var(--island-ink)]">{{ taskTitle }}</div>
    <div class="flex items-center gap-3">
      <span
        class="font-mono text-[26px] font-semibold tracking-[-0.02em]"
        :style="running ? 'color: var(--island-orange-2);' : 'color: var(--island-ink);'"
      >{{ timerStr(seconds) }}</span>
      <div class="flex gap-[6px] ml-auto">
        <button
          class="w-9 h-9 rounded-[10px] border-none cursor-pointer grid place-items-center"
          style="background: var(--island-orange); color: #fff;"
          :title="running ? 'Пауза' : 'Запустить'"
          :aria-label="running ? 'Пауза' : 'Запустить'"
          @click="$emit('toggle', $event)"
        >
          <UIcon :name="running ? 'i-lucide-pause' : 'i-lucide-play'" class="w-4 h-4" />
        </button>
        <button
          class="w-9 h-9 rounded-[10px] border-none cursor-pointer grid place-items-center"
          style="background: rgba(255,255,255,0.07); color: var(--island-ink);"
          title="Стоп"
          aria-label="Стоп"
          @click="$emit('stop', $event)"
        >
          <UIcon name="i-lucide-square" class="w-[14px] h-[14px]" />
        </button>
      </div>
    </div>
  </div>
</template>
