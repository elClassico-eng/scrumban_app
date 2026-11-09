<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { apiRoutes } from '~/routing'

const CARD_STYLES = [
  { value: 'cover' as const, label: 'Обложка', hint: 'Логотип на всю карточку' },
  { value: 'compact' as const, label: 'Компактный', hint: 'Логотип в углу' },
]

const { current: workspace } = useSettingsWorkspace()
const { update } = useWorkspacesApi()
const qc = useQueryClient()
const toast = useToast()

const canEdit = computed(() => hasRole(workspace.value?.role, 'admin'))

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  description: z.string().max(2000),
  cardStyle: z.enum(['cover', 'compact']),
})
type State = z.infer<typeof schema>
const state = reactive<State>({ name: '', description: '', cardStyle: 'cover' })

function fromWorkspace(): State {
  const w = workspace.value
  return { name: w?.name ?? '', description: w?.description ?? '', cardStyle: w?.cardStyle ?? 'cover' }
}

function reset() {
  Object.assign(state, fromWorkspace())
}

watch(workspace, reset, { immediate: true })
const dirty = computed(() => JSON.stringify(state) !== JSON.stringify(fromWorkspace()))

async function save() {
  if (!workspace.value) return
  try {
    await update.mutateAsync({
      workspaceId: workspace.value.id,
      name: state.name.trim(),
      description: state.description.trim() || null,
      cardStyle: state.cardStyle,
    })
    toast.add({ title: 'Сохранено', color: 'success', icon: 'i-hugeicons-checkmark-circle-02', duration: 1500 })
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось сохранить'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
}

async function removeLogo() {
  if (!workspace.value) return
  const fileId = fileIdFromUrl(workspace.value.logoUrl ?? null)
  if (fileId) await $fetch(`${apiRoutes.files(workspace.value.id)}/${fileId}`, { method: 'DELETE' })
  else await update.mutateAsync({ workspaceId: workspace.value.id, logoUrl: null })
}

const preview = computed(() => workspace.value && ({
  ...workspace.value,
  name: state.name.trim() || workspace.value.name,
  description: state.description.trim() || null,
  purpose: null,
  cardStyle: state.cardStyle,
}))
</script>

<template>
  <div v-if="workspace && preview" class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
    <SettingsTile title="Воркспейс" :description="canEdit ? undefined : 'Менять может администратор'">
      <UForm :schema="schema" :state="state" :disabled="!canEdit" class="space-y-4" @submit="save">
        <FilesImageUploader
          v-if="canEdit"
          :target="{ kind: 'workspace_logo', workspaceId: workspace.id }"
          :current-url="workspace.logoUrl ?? null"
          :fallback="state.name.slice(0, 1).toUpperCase() || '∗'"
          shape="rounded"
          :remove="removeLogo"
          @changed="qc.invalidateQueries()"
        />

        <UFormField label="Название" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField label="Описание" name="description" hint="видно на карточке">
          <UTextarea v-model="state.description" :rows="2" autoresize class="w-full" placeholder="Чем занимается команда" />
        </UFormField>

        <UFormField label="Вид карточки" name="cardStyle">
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="opt in CARD_STYLES"
              :key="opt.value"
              type="button"
              class="rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60"
              :class="state.cardStyle === opt.value ? 'border-accent-500 bg-accent-500/10' : 'border-default hover:bg-elevated'"
              :disabled="!canEdit"
              :aria-pressed="state.cardStyle === opt.value"
              @click="state.cardStyle = opt.value"
            >
              <span class="block text-sm font-medium text-default">{{ opt.label }}</span>
              <span class="block text-xs text-muted">{{ opt.hint }}</span>
            </button>
          </div>
        </UFormField>

        <div v-if="canEdit" class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" :disabled="!dirty" @click="reset">Отмена</UButton>
          <UButton type="submit" :disabled="!dirty" :loading="update.isPending.value">Сохранить</UButton>
        </div>
      </UForm>
    </SettingsTile>

    <div class="space-y-3">
      <p class="px-1 text-sm text-muted">Так воркспейс выглядит в списке</p>
      <WorkspaceCard :workspace="preview" class="pointer-events-none" />
    </div>
  </div>
</template>
