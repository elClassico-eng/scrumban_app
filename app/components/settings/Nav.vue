<script setup lang="ts">
import type { SettingsTab } from '~/routing'

const props = defineProps<{
  modelValue: SettingsTab
  teamLabel: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [SettingsTab] }>()

type Item = { key: SettingsTab; label: string; icon: string }

const accountItems: Item[] = [
  { key: 'profile', label: 'Профиль', icon: 'i-lucide-user' },
  { key: 'security', label: 'Безопасность', icon: 'i-lucide-lock' },
  { key: 'notifications', label: 'Уведомления', icon: 'i-lucide-bell' },
  { key: 'appearance', label: 'Внешний вид', icon: 'i-lucide-palette' },
  { key: 'danger', label: 'Опасная зона', icon: 'i-lucide-triangle-alert' },
]

const teamItems: Item[] = [
  { key: 'team', label: 'Команда', icon: 'i-lucide-users' },
]

const groups = computed(() => [
  { title: 'Аккаунт', items: accountItems },
  { title: props.teamLabel ?? 'Команда', items: teamItems },
])
</script>

<template>
  <nav class="flex gap-1 overflow-x-auto lg:block lg:space-y-6 lg:overflow-visible">
    <div v-for="group in groups" :key="group.title" class="flex gap-1 lg:block lg:space-y-1">
      <p class="hidden truncate px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted lg:block">
        {{ group.title }}
      </p>
      <button
        v-for="item in group.items"
        :key="item.key"
        type="button"
        class="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:w-full"
        :class="modelValue === item.key
          ? 'bg-elevated text-default'
          : 'text-muted hover:bg-elevated/60 hover:text-default'"
        @click="emit('update:modelValue', item.key)"
      >
        <UIcon
          :name="item.icon"
          class="size-4 shrink-0"
          :class="item.key === 'danger' && 'text-error-500'"
        />
        <span class="whitespace-nowrap">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>
