<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: false })

type FeedbackRow = {
  id: string
  liked: string | null
  disliked: string | null
  missing: string | null
  rating: number | null
  email: string | null
  team: string | null
  wantsReply: boolean
  userId: string | null
  createdAt: string
}

const { data, isLoading, error } = useQuery({
  queryKey: ['admin-feedback'],
  queryFn: () => $fetch<{ feedback: FeedbackRow[] }>(apiRoutes.adminFeedback),
  retry: false,
})

const items = computed(() => data.value?.feedback ?? [])
const forbidden = computed(() => getErrorStatus(error.value) === 403)

function sections(f: FeedbackRow) {
  return [
    { label: 'Нравится', text: f.liked },
    { label: 'Мешает', text: f.disliked },
    { label: 'Не хватает', text: f.missing },
  ].filter(s => s.text)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

useHead({ title: 'Отзывы – Такт' })
</script>

<template>
  <div class="min-h-dvh bg-default text-default">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div class="flex items-end justify-between gap-3 mb-6">
        <div>
          <NuxtLink
            :to="pageRoutes.workspaces"
            class="text-sm text-muted hover:text-default inline-flex items-center gap-1.5 mb-2"
          >
            <UIcon name="i-hugeicons-arrow-left-02" class="size-4" /> Воркспейсы
          </NuxtLink>
          <h1 class="text-2xl font-semibold tracking-tight">Отзывы</h1>
        </div>
        <div class="flex items-center gap-4 text-sm">
          <NuxtLink :to="pageRoutes.adminLeads" class="text-muted hover:text-default">Заявки</NuxtLink>
          <span v-if="!isLoading && !error" class="text-muted font-mono tabular-nums">{{ items.length }}</span>
        </div>
      </div>

      <div v-if="isLoading" class="h-40 grid place-items-center text-muted">
        <UIcon name="i-hugeicons-loader" class="animate-spin size-6" />
      </div>

      <div v-else-if="forbidden" class="h-40 grid place-items-center text-center">
        <div>
          <UIcon name="i-hugeicons-shield-x" class="size-10 text-muted mx-auto mb-3" />
          <p class="font-medium">Доступ запрещён</p>
          <p class="text-sm text-muted mt-1">Эта страница доступна только администратору.</p>
        </div>
      </div>

      <div v-else-if="error" class="h-40 grid place-items-center text-muted text-sm">
        Не удалось загрузить отзывы
      </div>

      <div v-else-if="items.length === 0" class="h-40 grid place-items-center text-muted text-sm">
        Пока нет отзывов
      </div>

      <ul v-else class="space-y-3">
        <li v-for="f in items" :key="f.id" class="border border-default rounded-xl p-4 sm:p-5">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mb-3">
            <span class="tabular-nums">{{ formatDate(f.createdAt) }}</span>
            <span v-if="f.rating" class="font-mono">оценка {{ f.rating }}/5</span>
            <span v-if="f.team">{{ f.team }}</span>
            <span v-if="f.userId">из приложения</span>
            <UBadge v-if="f.wantsReply" color="warning" variant="subtle" size="sm">ждёт ответа</UBadge>
          </div>
          <dl class="space-y-2 text-sm">
            <div v-for="s in sections(f)" :key="s.label">
              <dt class="text-xs font-medium text-muted">{{ s.label }}</dt>
              <dd class="whitespace-pre-line">{{ s.text }}</dd>
            </div>
          </dl>
          <a v-if="f.email" :href="`mailto:${f.email}`" class="inline-block mt-3 text-sm text-accent-600 hover:underline">{{ f.email }}</a>
        </li>
      </ul>
    </div>
  </div>
</template>
