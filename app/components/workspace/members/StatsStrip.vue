<script setup lang="ts">
import type { Role } from '#shared/types/domain'

const props = defineProps<{
  total: number
  adminsCount: number
  viewersCount: number
  pendingInvites: number
  activeFilter: Role | 'all'
}>()

const emit = defineEmits<{ 'update:activeFilter': [Role | 'all'] }>()

type Stat = {
  key: Role | 'all' | 'invites'
  label: string
  value: number
  icon: string
  iconClass: string
  iconClassPrimary?: string
  primary: boolean
  clickable: boolean
}

const stats = computed<Stat[]>(() => [
  {
    key: 'all',
    label: 'Всего в команде',
    value: props.total,
    icon: 'i-lucide-users',
    iconClass: 'bg-elevated text-default',
    iconClassPrimary: 'bg-white/10 text-accent-500',
    primary: true,
    clickable: true,
  },
  {
    key: 'admin',
    label: 'Админов',
    value: props.adminsCount,
    icon: 'i-lucide-shield-check',
    iconClass: 'bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-300',
    primary: false,
    clickable: true,
  },
  {
    key: 'viewer',
    label: 'Наблюдателей',
    value: props.viewersCount,
    icon: 'i-lucide-eye',
    iconClass: 'bg-info-50 text-info-600',
    primary: false,
    clickable: true,
  },
  {
    key: 'invites',
    label: 'Pending инвайтов',
    value: props.pendingInvites,
    icon: 'i-lucide-mail',
    iconClass: 'bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-300',
    primary: false,
    clickable: false,
  },
])

function onClick(stat: Stat) {
  if (!stat.clickable) return
  if (stat.key === 'all' || stat.key === 'admin' || stat.key === 'viewer') {
    const next = props.activeFilter === stat.key && stat.key !== 'all' ? 'all' : stat.key
    emit('update:activeFilter', next)
  }
}

function isActive(stat: Stat): boolean {
  return stat.clickable && props.activeFilter === stat.key
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-default bg-default overflow-hidden divide-x divide-default">
    <button
      v-for="stat in stats"
      :key="stat.key"
      type="button"
      :disabled="!stat.clickable"
      class="flex items-center gap-3 px-4 py-3 text-left transition-colors"
      :class="[
        stat.primary
          ? 'bg-primary text-inverted hover:bg-primary/95'
          : isActive(stat)
            ? 'bg-elevated'
            : stat.clickable
              ? 'hover:bg-elevated cursor-pointer'
              : 'cursor-default',
      ]"
      @click="onClick(stat)"
    >
      <span
        class="inline-flex size-9 items-center justify-center rounded-lg shrink-0"
        :class="stat.primary ? stat.iconClassPrimary : stat.iconClass"
      >
        <UIcon :name="stat.icon" class="size-4" />
      </span>
      <div class="min-w-0">
        <p
          class="text-xl font-semibold leading-tight tabular-nums tracking-tight"
          :class="stat.primary ? 'text-inverted' : 'text-default'"
        >
          {{ stat.value }}
        </p>
        <p
          class="text-[10px] truncate uppercase tracking-wider font-semibold mt-0.5"
          :class="stat.primary ? 'text-inverted/60' : 'text-muted'"
        >
          {{ stat.label }}
        </p>
      </div>
    </button>
  </div>
</template>
