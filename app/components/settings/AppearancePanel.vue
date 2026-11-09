<script setup lang="ts">
const THEMES = [
  { value: 'light', label: 'Светлая', icon: 'i-hugeicons-sun-03' },
  { value: 'dark', label: 'Тёмная', icon: 'i-hugeicons-moon' },
  { value: 'system', label: 'Как в системе', icon: 'i-hugeicons-computer' },
]

const colorMode = useColorMode()
const { prefs, set } = useAppearance()
</script>

<template>
  <div class="space-y-4">
    <SettingsTile title="Тема">
      <div class="grid gap-2 sm:grid-cols-3">
        <button
          v-for="t in THEMES"
          :key="t.value"
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
          :class="colorMode.preference === t.value ? 'border-accent-500 bg-accent-500/10 text-default' : 'border-zinc-200 dark:border-default text-muted hover:text-default'"
          :aria-pressed="colorMode.preference === t.value"
          @click="colorMode.preference = t.value"
        >
          <UIcon :name="t.icon" class="size-4" />
          {{ t.label }}
        </button>
      </div>
    </SettingsTile>

    <SettingsTile title="Интерфейс">
      <div class="divide-y divide-default">
        <div class="flex items-center justify-between gap-4 pb-3">
          <div>
            <p class="text-sm text-default">Компактные карточки</p>
            <p class="text-xs text-muted">Больше задач на экране доски</p>
          </div>
          <USwitch :model-value="prefs.compactCards" @update:model-value="set({ compactCards: $event })" />
        </div>
        <div class="flex items-center justify-between gap-4 pt-3">
          <div>
            <p class="text-sm text-default">Меньше анимаций</p>
            <p class="text-xs text-muted">Без плавных переходов и заставки</p>
          </div>
          <USwitch :model-value="prefs.reduceMotion" @update:model-value="set({ reduceMotion: $event })" />
        </div>
      </div>
    </SettingsTile>
  </div>
</template>
