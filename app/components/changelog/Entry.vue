<script setup lang="ts">
import type { ChangelogEntryDoc } from '~/composables/useChangelog'
import { pageRoutes } from '~/routing'

const props = defineProps<{ entry: ChangelogEntryDoc, workspaceId: string | null }>()

const formattedDate = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(props.entry.date)),
)

const tryTo = computed(() =>
  props.entry.tryRoute && props.workspaceId
    ? `${pageRoutes.workspace(props.workspaceId)}${props.entry.tryRoute}`
    : null,
)
</script>

<template>
  <article class="px-4 py-4 border-b border-default last:border-0">
    <div class="flex items-center gap-2 mb-1.5">
      <span class="text-[11px] uppercase tracking-wide font-medium text-primary">{{ entry.area }}</span>
      <span class="text-[11px] text-muted">{{ formattedDate }}</span>
    </div>
    <h3 class="text-sm font-semibold mb-1">{{ entry.title }}</h3>
    <div class="text-xs text-muted leading-relaxed [&_p]:mb-0">
      <ContentRenderer :value="entry" />
    </div>
    <div v-if="tryTo || entry.docsPath" class="flex gap-2 mt-2.5">
      <UButton
        v-if="tryTo"
        :to="tryTo"
        size="xs"
        color="primary"
        variant="soft"
        trailing-icon="i-lucide-arrow-right"
      >
        Попробовать
      </UButton>
      <UButton
        v-if="entry.docsPath"
        :to="entry.docsPath"
        size="xs"
        color="neutral"
        variant="ghost"
      >
        Подробнее
      </UButton>
    </div>
  </article>
</template>
