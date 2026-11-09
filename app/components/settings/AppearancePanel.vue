<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { BACKGROUND_PRESET_IDS, type AppearanceBackground } from '#shared/types/appearance'
import { apiRoutes } from '~/routing'

const THEMES = [
  { value: 'light', label: 'Светлая', icon: 'i-hugeicons-sun-03' },
  { value: 'dark', label: 'Тёмная', icon: 'i-hugeicons-moon' },
  { value: 'system', label: 'Как в системе', icon: 'i-hugeicons-computer' },
]

const colorMode = useColorMode()
const { prefs, set } = useAppearance()
const { upload, items } = useFileUploader()
const qc = useQueryClient()
const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)

const bg = computed(() => prefs.value.background)
const uploading = computed(() => items.value.some(i => i.status === 'uploading'))
const ownFileUrl = computed(() => (bg.value.kind === 'file' ? bg.value.url : null))

function isActive(candidate: AppearanceBackground): boolean {
  if (candidate.kind !== bg.value.kind) return false
  return candidate.kind !== 'preset' || (bg.value.kind === 'preset' && bg.value.presetId === candidate.presetId)
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (fileInput.value) fileInput.value.value = ''
  if (!file) return
  const done = await upload(file, { kind: 'user_background' })
  if (done) await qc.invalidateQueries({ queryKey: ['users', 'me'] })
}

async function removeOwn() {
  try {
    await $fetch(apiRoutes.background, { method: 'DELETE' })
    await qc.invalidateQueries({ queryKey: ['users', 'me'] })
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось убрать фон'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
}

watch(() => items.value.find(i => i.status === 'error'), (failed) => {
  if (failed) toast.add({ title: failed.error ?? 'Не удалось загрузить фон', color: 'error', icon: 'i-hugeicons-alert-circle' })
})
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

    <SettingsTile title="Фон приложения" description="Ляжет под всё приложение. Выбери и сразу смотри – эта страница тоже превью">
      <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <button
          type="button"
          class="group flex flex-col gap-1.5 text-left"
          :aria-pressed="isActive({ kind: 'none' })"
          @click="set({ background: { kind: 'none' } })"
        >
          <span
            class="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-accented bg-default text-muted transition"
            :class="isActive({ kind: 'none' }) && 'ring-2 ring-accent-500 ring-offset-2 ring-offset-(--ui-bg)'"
          >
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
          <span
            class="aspect-[4/3] w-full rounded-xl border border-default transition"
            :class="isActive({ kind: 'preset', presetId: id }) && 'ring-2 ring-accent-500 ring-offset-2 ring-offset-(--ui-bg)'"
            :style="{ background: BACKGROUND_PRESETS[id].image }"
          />
          <span class="text-xs text-muted">{{ BACKGROUND_PRESETS[id].label }}</span>
        </button>

        <div class="flex flex-col gap-1.5">
          <button
            v-if="ownFileUrl"
            type="button"
            class="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-default ring-2 ring-accent-500 ring-offset-2 ring-offset-(--ui-bg)"
            aria-label="Свой фон"
          >
            <img :src="ownFileUrl" alt="" class="size-full object-cover">
          </button>
          <button
            v-else
            type="button"
            class="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-accented text-muted transition hover:text-default"
            :disabled="uploading"
            @click="fileInput?.click()"
          >
            <UIcon :name="uploading ? 'i-hugeicons-loading-03' : 'i-hugeicons-image-add-01'" class="size-5" :class="uploading && 'animate-spin'" />
          </button>
          <span class="flex items-center gap-2 text-xs text-muted">
            {{ ownFileUrl ? 'Свой' : 'Загрузить' }}
            <button v-if="ownFileUrl" type="button" class="underline hover:text-default" @click="fileInput?.click()">заменить</button>
            <button v-if="ownFileUrl" type="button" class="underline hover:text-error" @click="removeOwn">убрать</button>
          </span>
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile">
        </div>
      </div>
      <p class="mt-3 text-xs text-muted">JPEG, PNG или WebP до 5 МБ. Свой фон видишь только ты.</p>
    </SettingsTile>

    <SettingsTile v-if="bg.kind !== 'none'" title="Читаемость" description="Затемнение и размытие держат текст читаемым на любой картинке">
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
