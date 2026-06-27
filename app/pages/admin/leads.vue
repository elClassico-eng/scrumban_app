<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: false })

type LeadRow = {
  id: string
  email: string
  team: string | null
  intents: string
  source: string
  createdAt: string
}

const INTENT_LABEL: Record<string, string> = {
  try: 'Попробовать',
  partner: 'Сотрудничество',
  follow: 'Следить',
}

const { data, isLoading, error } = useQuery({
  queryKey: ['admin-leads'],
  queryFn: () => $fetch<{ leads: LeadRow[] }>(apiRoutes.adminLeads),
  retry: false,
})

const leads = computed(() => data.value?.leads ?? [])
const forbidden = computed(() => getErrorStatus(error.value) === 403)

function intentLabels(raw: string): string {
  if (!raw) return '—'
  return raw.split(',').map(k => INTENT_LABEL[k] ?? k).join(', ')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

useHead({ title: 'Заявки — Такт' })
</script>

<template>
  <div class="min-h-dvh bg-default text-default">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div class="flex items-center justify-between gap-3 mb-6">
        <div>
          <NuxtLink
            :to="pageRoutes.workspaces"
            class="text-sm text-muted hover:text-default inline-flex items-center gap-1.5 mb-2"
          >
            <UIcon name="i-lucide-arrow-left" class="size-4" /> Воркспейсы
          </NuxtLink>
          <h1 class="text-2xl font-semibold tracking-tight">Заявки с лендинга</h1>
        </div>
        <span v-if="!isLoading && !error" class="text-sm text-muted font-mono tabular-nums">{{ leads.length }}</span>
      </div>

      <div v-if="isLoading" class="h-40 grid place-items-center text-muted">
        <UIcon name="i-lucide-loader" class="animate-spin size-6" />
      </div>

      <div v-else-if="forbidden" class="h-40 grid place-items-center text-center">
        <div>
          <UIcon name="i-lucide-shield-x" class="size-10 text-muted mx-auto mb-3" />
          <p class="font-medium">Доступ запрещён</p>
          <p class="text-sm text-muted mt-1">Эта страница доступна только администратору.</p>
        </div>
      </div>

      <div v-else-if="error" class="h-40 grid place-items-center text-muted text-sm">
        Не удалось загрузить заявки
      </div>

      <div v-else-if="leads.length === 0" class="h-40 grid place-items-center text-muted text-sm">
        Пока нет заявок
      </div>

      <div v-else class="border border-default rounded-xl overflow-x-auto">
        <table class="w-full text-sm min-w-[560px]">
          <thead>
            <tr class="bg-elevated text-muted text-xs uppercase tracking-wide">
              <th class="text-left font-medium px-4 py-3">Email</th>
              <th class="text-left font-medium px-4 py-3">Команда / роль</th>
              <th class="text-left font-medium px-4 py-3">Интерес</th>
              <th class="text-left font-medium px-4 py-3 whitespace-nowrap">Дата</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lead in leads" :key="lead.id" class="border-t border-default">
              <td class="px-4 py-3">
                <a :href="`mailto:${lead.email}`" class="text-accent-600 hover:underline">{{ lead.email }}</a>
              </td>
              <td class="px-4 py-3 text-toned">{{ lead.team || '—' }}</td>
              <td class="px-4 py-3 text-toned">{{ intentLabels(lead.intents) }}</td>
              <td class="px-4 py-3 text-muted whitespace-nowrap tabular-nums">{{ formatDate(lead.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
