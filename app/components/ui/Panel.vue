<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  hint?: string
  caption?: string
  padded?: boolean
  as?: 'section' | 'div'
}>(), { title: undefined, hint: undefined, caption: undefined, padded: true, as: 'section' })
</script>

<template>
  <component :is="as" class="surface-soft rounded-2xl flex flex-col min-w-0">
    <div
      v-if="title || $slots.title || $slots.actions"
      class="flex items-center justify-between gap-3 px-5 pt-4"
      :class="padded ? 'pb-3' : 'pb-3 border-b border-default'"
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <slot name="title">
          <h2 class="m-0 text-[15px] font-semibold text-default truncate">{{ title }}</h2>
        </slot>
        <AnalyticsInfo v-if="hint" :answers="hint" />
        <slot name="meta" />
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span v-if="caption" class="text-xs text-muted">{{ caption }}</span>
        <slot name="actions" />
      </div>
    </div>
    <div class="min-w-0 flex-1" :class="padded ? 'px-5 pb-5' : ''">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-5 pb-4">
      <slot name="footer" />
    </div>
  </component>
</template>
