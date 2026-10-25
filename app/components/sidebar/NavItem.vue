<script setup lang="ts">
import { Motion } from 'motion-v'
import { SIDEBAR_ROW, SIDEBAR_SPRING, sidebarFade } from '~/utils/sidebar-items'

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
    :delay-duration="700"
  >
    <template v-if="combo" #content>
      <span class="flex items-center gap-2">{{ label }} <UiComboKeys :combo="combo" size="sm" /></span>
    </template>
    <a
      v-if="external"
      :href="to"
      target="_blank"
      rel="noopener"
      :class="[SIDEBAR_ROW, 'pl-3 pr-2.5 text-muted hover:bg-elevated hover:text-default']"
    >
      <UIcon :name="icon" class="size-4 shrink-0" />
      <span :class="['min-w-0 flex-1 truncate', sidebarFade(collapsed)]">{{ label }}</span>
      <UIcon name="i-hugeicons-arrow-up-right-01" :class="['size-3.5 shrink-0 opacity-60', sidebarFade(collapsed)]" />
    </a>
    <NuxtLink v-else v-slot="{ href, navigate, isActive, isExactActive }" :to="to" custom>
      <a
        :href="href"
        :aria-current="(exact ? isExactActive : isActive) ? 'page' : undefined"
        :class="[
          SIDEBAR_ROW,
          'pl-3 pr-2.5',
          (exact ? isExactActive : isActive)
            ? 'text-highlighted font-semibold'
            : 'text-muted hover:bg-elevated hover:text-default',
        ]"
        @click="navigate"
      >
        <Motion
          v-if="exact ? isExactActive : isActive"
          layout-id="sidebar-active"
          :layout-dependency="0"
          class="absolute inset-0 rounded-xl bg-accented"
          :transition="SIDEBAR_SPRING"
        />
        <span class="relative shrink-0">
          <UIcon :name="icon" class="block size-4" />
          <span
            v-if="badge"
            :class="[
              'absolute -right-1 -top-1 size-2 rounded-full ring-2 ring-default transition-opacity duration-200',
              badgeTone === 'accent' ? 'bg-accent-500' : 'bg-[var(--ui-text-dimmed)]',
              collapsed ? 'opacity-100' : 'opacity-0',
            ]"
          />
        </span>
        <span :class="['relative min-w-0 flex-1 truncate', sidebarFade(collapsed)]">{{ label }}</span>
        <span
          v-if="badge"
          :class="[
            'relative ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums',
            badgeTone === 'accent' ? 'bg-accent-500 text-white' : 'text-dimmed',
            sidebarFade(collapsed),
          ]"
        >{{ badge > 99 ? '99+' : badge }}</span>
      </a>
    </NuxtLink>
  </UTooltip>
</template>
