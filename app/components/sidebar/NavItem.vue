<script setup lang="ts">
import { Motion } from 'motion-v'
import { SIDEBAR_SPRING } from '~/utils/sidebar-items'

withDefaults(defineProps<{
  to: string
  icon: string
  label: string
  collapsed: boolean
  exact?: boolean
  external?: boolean
  badge?: number
  badgeTone?: 'accent' | 'muted'
  combo?: string
}>(), { exact: false, external: false, badge: 0, badgeTone: 'muted', combo: undefined })
</script>

<template>
  <UTooltip
    :text="label"
    :disabled="!collapsed && !combo"
    :content="{ side: 'right' }"
    :delay-duration="collapsed ? 0 : 700"
  >
    <template v-if="combo" #content>
      <span class="flex items-center gap-2">{{ label }} <UiComboKeys :combo="combo" size="sm" /></span>
    </template>
    <a
      v-if="external"
      :href="to"
      target="_blank"
      rel="noopener"
      :class="[
        'flex items-center rounded-xl text-sm font-medium transition-colors duration-200',
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
        'text-muted hover:bg-elevated hover:text-default',
      ]"
    >
      <UIcon :name="icon" class="size-4 shrink-0" />
      <span v-if="!collapsed" class="truncate">{{ label }}</span>
      <UIcon v-if="!collapsed" name="i-hugeicons-arrow-up-right-01" class="ml-auto size-3.5 opacity-60" />
    </a>
    <NuxtLink v-else v-slot="{ href, navigate, isActive, isExactActive }" :to="to" custom>
      <a
        :href="href"
        :aria-current="(exact ? isExactActive : isActive) ? 'page' : undefined"
        :class="[
          'relative flex items-center rounded-xl text-sm font-medium transition-colors duration-200',
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          (exact ? isExactActive : isActive)
            ? 'text-highlighted font-semibold'
            : 'text-muted hover:bg-elevated hover:text-default',
        ]"
        @click="navigate"
      >
        <Motion
          v-if="exact ? isExactActive : isActive"
          layout-id="sidebar-active"
          class="absolute inset-0 rounded-xl bg-accented"
          :transition="SIDEBAR_SPRING"
        />
        <span class="relative shrink-0">
          <UIcon :name="icon" class="block size-4" />
          <span
            v-if="collapsed && badge"
            :class="['absolute -right-1 -top-1 size-2 rounded-full ring-2 ring-default', badgeTone === 'accent' ? 'bg-accent-500' : 'bg-[var(--ui-text-dimmed)]']"
          />
        </span>
        <span v-if="!collapsed" class="relative min-w-0 flex-1 truncate">{{ label }}</span>
        <span
          v-if="!collapsed && badge"
          :class="[
            'relative ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums',
            badgeTone === 'accent' ? 'bg-accent-500 text-white' : 'text-dimmed',
          ]"
        >{{ badge > 99 ? '99+' : badge }}</span>
      </a>
    </NuxtLink>
  </UTooltip>
</template>
