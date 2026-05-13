<script setup lang="ts">
import { z } from 'zod'
import { pageRoutes } from '~/routing'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list, update } = useWorkspacesApi()
const toast = useToast()

const workspace = computed(() =>
  list.data.value?.workspaces.find(w => w.id === wsId.value),
)
const canEdit = computed(() => hasRole(workspace.value?.role, 'admin'))

watchEffect(() => {
  if (workspace.value && !canEdit.value) {
    router.push(pageRoutes.boards(wsId.value))
  }
})

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} — Настройки`
    : 'Настройки — Scrumban',
})

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  description: z.string().max(2000),
  purpose: z.string().max(2000),
  industry: z.string().trim().max(100),
  logoUrl: z.union([z.url().max(2000), z.literal('')]),
})

type State = z.infer<typeof schema>
const state = reactive<State>({
  name: '',
  description: '',
  purpose: '',
  industry: '',
  logoUrl: '',
})

watch(
  workspace,
  (w) => {
    if (!w) return
    state.name = w.name
    state.description = w.description ?? ''
    state.purpose = w.purpose ?? ''
    state.industry = w.industry ?? ''
    state.logoUrl = w.logoUrl ?? ''
  },
  { immediate: true },
)

async function onSubmit() {
  if (!workspace.value) return
  try {
    await update.mutateAsync({
      workspaceId: workspace.value.id,
      name: state.name,
      description: state.description.trim() || null,
      purpose: state.purpose.trim() || null,
      industry: state.industry.trim() || null,
      logoUrl: state.logoUrl.trim() || null,
    })
    toast.add({
      title: 'Настройки сохранены',
      color: 'success',
      icon: 'i-lucide-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 space-y-8">
    <div class="space-y-1">
      <h1 class="text-2xl font-bold tracking-tight">Настройки команды</h1>
      <p v-if="workspace" class="text-sm text-muted">
        Workspace <span class="font-mono">{{ workspace.slug }}</span>
      </p>
    </div>

    <div v-if="list.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UForm
      v-else-if="workspace && canEdit"
      :schema="schema"
      :state="state"
      class="space-y-6"
      @submit="onSubmit"
    >
      <UCard>
        <template #header>
          <h2 class="font-semibold">Общая информация</h2>
        </template>
        <div class="space-y-4">
          <UFormField label="Название команды" name="name" required>
            <UInput v-model="state.name" class="w-full" />
          </UFormField>
          <UFormField
            label="Индустрия"
            name="industry"
            description="К какой отрасли относится команда — IT, дизайн-студия, агентство и т.д."
          >
            <UInput
              v-model="state.industry"
              class="w-full"
              placeholder="IT / агентство / промышленность"
            />
          </UFormField>
          <UFormField
            label="Логотип (URL)"
            name="logoUrl"
            description="Ссылка на изображение, которое будем показывать рядом с названием команды"
          >
            <UInput v-model="state.logoUrl" class="w-full" placeholder="https://..." />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">О команде</h2>
        </template>
        <div class="space-y-4">
          <UFormField
            label="Чем занимается команда"
            name="description"
            description="Чем команда занимается на ежедневной основе"
          >
            <UTextarea
              v-model="state.description"
              :rows="3"
              class="w-full"
              placeholder="Кратко опишите специализацию команды"
            />
          </UFormField>
          <UFormField
            label="Цель использования"
            name="purpose"
            description="Для чего планируется использовать платформу"
          >
            <UTextarea
              v-model="state.purpose"
              :rows="3"
              class="w-full"
              placeholder="Например: трекинг разработческих задач + аналитика flow"
            />
          </UFormField>
        </div>
      </UCard>

      <div class="flex justify-end">
        <UButton type="submit" :loading="update.isPending.value">
          Сохранить
        </UButton>
      </div>
    </UForm>
  </div>
</template>