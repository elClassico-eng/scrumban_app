<script setup lang="ts">
import type { ChangelogEntryDoc } from '~/composables/useChangelog'
import { pageRoutes } from '~/routing'

const props = defineProps<{ entry: ChangelogEntryDoc, workspaceId: string | null }>()
const emit = defineEmits<{ navigate: [] }>()

const formattedDate = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(props.entry.date)),
)

function tryLink(route?: string) {
  return route && props.workspaceId ? `${pageRoutes.workspace(props.workspaceId)}${route}` : null
}

const highlights = computed(() => props.entry.highlights ?? [])
const isVideo = (src: string) => /\.(webm|mp4)$/i.test(src)
</script>

<template>
  <article class="space-y-7 px-5 py-6 sm:px-8">
    <header class="space-y-2">
      <div class="flex items-center gap-2.5">
        <span v-if="entry.version" class="rounded-lg bg-accent-500 px-2 py-0.5 text-[13px] font-bold text-white">{{ entry.version }}</span>
        <span class="text-[12px] text-muted">{{ entry.area }} · {{ formattedDate }}</span>
      </div>
      <h2 class="m-0 text-2xl font-semibold tracking-tight text-highlighted">{{ entry.title }}</h2>
      <p v-if="entry.summary" class="m-0 max-w-2xl text-[14px] leading-relaxed text-muted">{{ entry.summary }}</p>
    </header>

    <section v-if="highlights.length" class="grid gap-4 lg:grid-cols-2">
      <div v-for="h in highlights" :key="h.title" class="surface flex flex-col overflow-hidden rounded-2xl">
        <div v-if="h.media" class="aspect-[16/10] overflow-hidden border-b border-default bg-elevated">
          <video
            v-if="isVideo(h.media)"
            :src="h.media"
            class="size-full object-cover object-top"
            autoplay
            muted
            loop
            playsinline
            preload="metadata"
          />
          <img v-else :src="h.media" :alt="h.title" class="size-full object-cover object-top" loading="lazy">
        </div>
        <div class="flex flex-1 flex-col gap-1.5 p-4">
          <h3 class="m-0 text-[15px] font-semibold text-highlighted">{{ h.title }}</h3>
          <p class="m-0 flex-1 text-[13px] leading-relaxed text-muted">{{ h.text }}</p>
          <UButton
            v-if="tryLink(h.tryRoute)"
            :to="tryLink(h.tryRoute)!"
            size="xs"
            color="neutral"
            variant="soft"
            trailing-icon="i-hugeicons-arrow-right-02"
            class="mt-1.5 self-start"
            @click="emit('navigate')"
          >
            Попробовать
          </UButton>
        </div>
      </div>
    </section>

    <section class="space-y-2">
      <h3 v-if="highlights.length" class="m-0 text-[11px] font-semibold uppercase tracking-wider text-dimmed">Другие улучшения</h3>
      <div class="changelog-body text-[13.5px] leading-relaxed text-default">
        <ContentRenderer :value="entry" />
      </div>
    </section>

    <footer v-if="tryLink(entry.tryRoute) || entry.docsPath" class="flex flex-wrap gap-2 border-t border-default pt-4">
      <UButton v-if="tryLink(entry.tryRoute)" :to="tryLink(entry.tryRoute)!" size="sm" trailing-icon="i-hugeicons-arrow-right-02" @click="emit('navigate')">
        Попробовать
      </UButton>
      <UButton v-if="entry.docsPath" :to="entry.docsPath" target="_blank" size="sm" color="neutral" variant="ghost" trailing-icon="i-hugeicons-arrow-up-right-01">
        Документация
      </UButton>
    </footer>
  </article>
</template>

<style scoped>
.changelog-body :deep(ul) { display: grid; gap: 0.5rem; padding-left: 1.1rem; list-style: disc; }
.changelog-body :deep(p) { margin: 0 0 0.5rem; }
.changelog-body :deep(strong) { color: var(--ui-text-highlighted); }
</style>
