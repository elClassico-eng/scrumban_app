<script setup lang="ts">
import type { NextAction } from '~/utils/next-actions'

defineProps<{ actions: NextAction[] }>()

const uiStore = useUiStore()

const TONE: Record<NextAction['tone'], string> = {
  danger: '#e5484d',
  warning: '#f5a524',
  accent: 'var(--island-orange-2)',
  neutral: 'var(--island-ink-3)',
}
</script>

<template>
  <section class="shrink-0">
    <div class="mb-[7px] px-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)]">
      Следующий шаг
    </div>
    <div
      v-if="!actions.length"
      class="flex items-center gap-2 rounded-2xl px-[13px] py-[11px] text-[12.5px] text-[var(--island-ink-2)]"
      style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
    >
      <UIcon name="i-hugeicons-checkmark-circle-02" class="size-4 text-[var(--island-ink-3)]" />
      Всё под контролем: ничего не горит
    </div>
    <div v-else class="grid grid-cols-3 gap-[10px]">
      <NuxtLink
        v-for="(a, i) in actions"
        :key="a.id"
        :to="a.to"
        class="inbox-row-in group flex min-h-[92px] flex-col gap-[6px] rounded-2xl p-[12px] transition-colors hover:bg-[var(--island-hover)]"
        :style="{ '--i': i, background: 'var(--island-tile)', border: '1px solid var(--island-line-2)' }"
        @click="uiStore.closeControlCenter"
      >
        <span class="flex items-center justify-between">
          <span
            class="grid size-[26px] place-items-center rounded-lg"
            :style="{ color: TONE[a.tone], background: `color-mix(in srgb, ${TONE[a.tone]} 14%, transparent)` }"
          >
            <UIcon :name="a.icon" class="size-[14px]" />
          </span>
          <UIcon name="i-hugeicons-arrow-up-right-01" class="size-3 text-[var(--island-ink-3)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
        <b class="line-clamp-2 text-[12.5px] font-semibold leading-[1.3] text-[var(--island-ink)]">{{ a.title }}</b>
        <span class="line-clamp-2 text-[11.5px] leading-[1.35] text-[var(--island-ink-3)]">{{ a.reason }}</span>
      </NuxtLink>
    </div>
  </section>
</template>
