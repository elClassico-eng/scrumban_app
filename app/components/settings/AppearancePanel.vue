<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { BACKGROUND_PRESET_IDS, type AppearanceBackground } from '#shared/types/appearance'
import type { BackgroundView } from '#shared/types/files'
import { apiRoutes } from '~/routing'

const THEMES = [
  { value: 'light', label: 'Светлая', icon: 'i-hugeicons-sun-03' },
  { value: 'dark', label: 'Тёмная', icon: 'i-hugeicons-moon' },
  { value: 'system', label: 'Как в системе', icon: 'i-hugeicons-computer' },
]

const colorMode = useColorMode()
const { prefs, set, forgetBackground } = useAppearance()
const { upload, items } = useFileUploader()
const qc = useQueryClient()
const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)

const recent = useQuery({
  queryKey: ['users', 'me', 'backgrounds'],
  queryFn: () => $fetch<{ backgrounds: BackgroundView[] }>(apiRoutes.backgrounds).then(r => r.backgrounds),
})

const bg = computed(() => prefs.value.background)
const uploading = computed(() => items.value.some(i => i.status === 'uploading'))

function isActive(candidate: AppearanceBackground): boolean {
  if (candidate.kind !== bg.value.kind) return false
  if (candidate.kind === 'preset') return bg.value.kind === 'preset' && bg.value.presetId === candidate.presetId
  if (candidate.kind === 'file') return bg.value.kind === 'file' && bg.value.url === candidate.url
  return true
}

function fail(err: unknown, fallback: string) {
  toast.add({ title: getErrorMessage(err, fallback), color: 'error', icon: 'i-hugeicons-alert-circle' })
}

async function refresh() {
  forgetBackground()
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['users', 'me'], exact: true }),
    qc.invalidateQueries({ queryKey: ['users', 'me', 'backgrounds'] }),
  ])
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (fileInput.value) fileInput.value.value = ''
  if (!file) return
  if (await upload(file, { kind: 'user_background' })) await refresh()
}

async function pick(file: BackgroundView) {
  try {
    await $fetch(`${apiRoutes.background}/${file.id}/select`, { method: 'POST' })
    await refresh()
  }
  catch (err) {
    fail(err, 'Не удалось выбрать фон')
  }
}

async function remove(file: BackgroundView) {
  try {
    await $fetch(`${apiRoutes.background}/${file.id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (err) {
    fail(err, 'Не удалось удалить фон')
  }
}

watch(() => items.value.find(i => i.status === 'error'), (failed) => {
  if (failed) fail(failed.error, 'Не удалось загрузить фон')
})

const RING = 'ring-2 ring-accent-500 ring-offset-2 ring-offset-(--ui-bg)'
</script>

<template>
  <div class="space-y-4">
    <SettingsTile title="Тема">
      <div class="grid gap-2 sm:grid-cols-3">
        <button
          v-for="t in THEMES"
          :key="t.value"
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
          :class="colorMode.preference === t.value ? 'border-accent-500 bg-accent-500/10 text-default' : 'border-default text-muted hover:text-default'"
          :aria-pressed="colorMode.preference === t.value"
          @click="colorMode.preference = t.value"
        >
          <UIcon :name="t.icon" class="size-4" />
          {{ t.label }}
        </button>
      </div>
    </SettingsTile>

    <SettingsTile title="Фон приложения" description="Выбери и сразу смотри: панели подстроятся под цвет картинки">
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Готовые</p>
      <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <button type="button" class="flex flex-col gap-1.5 text-left" :aria-pressed="isActive({ kind: 'none' })" @click="set({ background: { kind: 'none' } })">
          <span class="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-accented bg-default text-muted" :class="isActive({ kind: 'none' }) && RING">
            <UIcon name="i-hugeicons-cancel-01" class="size-5" />
          </span>
          <span class="text-xs text-muted">Без фона</span>
        </button>
        <button
          v-for="id in BACKGROUND_PRESET_IDS"
          :key="id"
          type="button"
          class="flex flex-col gap-1.5 text-left"
          :aria-pressed="isActive({ kind: 'preset', presetId: id })"
          @click="set({ background: { kind: 'preset', presetId: id } })"
        >
          <span class="aspect-[4/3] w-full rounded-xl border border-default" :class="isActive({ kind: 'preset', presetId: id }) && RING" :style="{ background: BACKGROUND_PRESETS[id].image }" />
          <span class="text-xs text-muted">{{ BACKGROUND_PRESETS[id].label }}</span>
        </button>
      </div>

      <p class="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted">Мои картинки</p>
      <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <div v-for="file in recent.data.value ?? []" :key="file.id" class="group relative">
          <button
            type="button"
            class="block aspect-[4/3] w-full overflow-hidden rounded-xl border border-default"
            :class="isActive({ kind: 'file', url: file.url }) && RING"
            :aria-pressed="isActive({ kind: 'file', url: file.url })"
            :style="{ backgroundColor: file.color ?? undefined }"
            @click="pick(file)"
          >
            <img :src="file.url" alt="" class="size-full object-cover" loading="lazy">
          </button>
          <button
            type="button"
            class="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            aria-label="Удалить картинку"
            @click="remove(file)"
          >
            <UIcon name="i-hugeicons-cancel-01" class="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          class="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-accented text-muted transition hover:text-default"
          :disabled="uploading"
          aria-label="Загрузить картинку"
          @click="fileInput?.click()"
        >
          <UIcon :name="uploading ? 'i-hugeicons-loading-03' : 'i-hugeicons-image-add-01'" class="size-5" :class="uploading && 'animate-spin'" />
        </button>
        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile">
      </div>
      <p class="mt-3 text-xs text-muted">JPEG, PNG или WebP до 10 МБ, в оригинальном качестве. Храним 8 последних, их видишь только ты.</p>
    </SettingsTile>

    <SettingsTile v-if="bg.kind !== 'none'" title="Читаемость" description="Затемнение приглушает картинку, размытие делает панели матовыми">
      <div class="grid gap-6 sm:grid-cols-2">
        <UFormField :label="`Затемнение · ${Math.round(prefs.dim * 100)}%`">
          <USlider :model-value="prefs.dim" :min="0" :max="0.8" :step="0.05" @update:model-value="set({ dim: $event as number })" />
        </UFormField>
        <UFormField :label="`Размытие · ${prefs.blur} px`">
          <USlider :model-value="prefs.blur" :min="0" :max="20" :step="1" @update:model-value="set({ blur: $event as number })" />
        </UFormField>
      </div>
    </SettingsTile>

    <SettingsTile title="Интерфейс">
      <div class="divide-y divide-default">
        <div class="flex items-center justify-between gap-4 pb-3">
          <div>
            <p class="text-sm text-default">Компактные карточки</p>
            <p class="text-xs text-muted">Больше задач на экране доски</p>
          </div>
          <USwitch :model-value="prefs.compactCards" @update:model-value="set({ compactCards: $event })" />
        </div>
        <div class="flex items-center justify-between gap-4 pt-3">
          <div>
            <p class="text-sm text-default">Меньше анимаций</p>
            <p class="text-xs text-muted">Без плавных переходов и заставки</p>
          </div>
          <USwitch :model-value="prefs.reduceMotion" @update:model-value="set({ reduceMotion: $event })" />
        </div>
      </div>
    </SettingsTile>
  </div>
</template>
