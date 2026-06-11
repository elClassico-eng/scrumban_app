<script setup lang="ts">
const props = defineProps<{
  focusOn: boolean
  isDark: boolean
  canCreateTask: boolean
}>()

const emit = defineEmits<{
  task: [e: Event]
  search: [e: Event]
  'toggle-focus': [e: Event]
  'toggle-theme': [e: Event]
  logout: [e: Event]
}>()

const themeIcon = computed(() => props.isDark ? 'i-lucide-sun' : 'i-lucide-moon')

type ActionStyle = 'primary' | 'toggle-active' | 'normal'

function btnStyle(style: ActionStyle): string {
  if (style === 'primary') return 'background: var(--island-orange); color: #fff;'
  if (style === 'toggle-active') return 'background: rgba(255,106,26,0.18); color: var(--island-orange-2);'
  return 'background: rgba(255,255,255,0.05); color: var(--island-ink-2);'
}
</script>

<template>
  <div class="flex gap-2">
    <button
      class="flex-1 h-[46px] border-none rounded-[13px] cursor-pointer flex flex-col items-center justify-center gap-[3px] text-[9.5px] font-semibold transition-colors"
      :class="{ 'opacity-40 cursor-not-allowed': !canCreateTask }"
      :style="canCreateTask ? btnStyle('primary') : btnStyle('normal')"
      :disabled="!canCreateTask"
      title="Задача"
      aria-label="Задача"
      @click="emit('task', $event)"
    >
      <UIcon name="i-lucide-plus" class="w-4 h-4" />
      Задача
    </button>
    <button
      class="flex-1 h-[46px] border-none rounded-[13px] cursor-pointer flex flex-col items-center justify-center gap-[3px] text-[9.5px] font-semibold transition-colors"
      :style="btnStyle('normal')"
      title="Поиск"
      aria-label="Поиск"
      @click="emit('search', $event)"
    >
      <UIcon name="i-lucide-search" class="w-4 h-4" />
      Поиск
    </button>
    <button
      class="flex-1 h-[46px] border-none rounded-[13px] cursor-pointer flex flex-col items-center justify-center gap-[3px] text-[9.5px] font-semibold transition-colors"
      :style="focusOn ? btnStyle('toggle-active') : btnStyle('normal')"
      title="Фокус"
      aria-label="Фокус"
      @click="emit('toggle-focus', $event)"
    >
      <UIcon name="i-lucide-focus" class="w-4 h-4" />
      Фокус
    </button>
    <button
      class="flex-1 h-[46px] border-none rounded-[13px] cursor-pointer flex flex-col items-center justify-center gap-[3px] text-[9.5px] font-semibold transition-colors"
      :style="btnStyle('normal')"
      title="Тема"
      aria-label="Тема"
      @click="emit('toggle-theme', $event)"
    >
      <UIcon :name="themeIcon" class="w-4 h-4" />
      Тема
    </button>
    <button
      class="flex-1 h-[46px] border-none rounded-[13px] cursor-pointer flex flex-col items-center justify-center gap-[3px] text-[9.5px] font-semibold transition-colors"
      :style="btnStyle('normal')"
      title="Выход"
      aria-label="Выход"
      @click="emit('logout', $event)"
    >
      <UIcon name="i-lucide-log-out" class="w-4 h-4" />
      Выход
    </button>
  </div>
</template>
