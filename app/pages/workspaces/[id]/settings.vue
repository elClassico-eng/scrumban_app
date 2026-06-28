<script setup lang="ts">
import { z } from 'zod'
import { pageRoutes } from '~/routing'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list, update } = useWorkspacesApi()
const { list: membersList } = useMembersApi(wsId)
const toast = useToast()

const workspace = computed(() =>
  list.data.value?.workspaces.find(w => w.id === wsId.value),
)
const canEdit = computed(() => hasRole(workspace.value?.role, 'admin'))

const membersCount = computed(() => membersList.data.value?.members.length ?? 0)
const membersWord = computed(() => plural(membersCount.value, ['участник', 'участника', 'участников']))

const createdLabel = computed(() => {
  const at = workspace.value?.createdAt
  if (!at) return null
  return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
})

watchEffect(() => {
  if (workspace.value && !canEdit.value) {
    router.push(pageRoutes.boards(wsId.value))
  }
})

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} — Настройки`
    : 'Настройки — Такт',
})

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  description: z.string().max(2000),
  purpose: z.string().max(2000),
  industry: z.string().trim().max(100),
  logoUrl: z.union([z.url().max(2000), z.literal('')]),
  cardStyle: z.enum(['cover', 'compact']),
})

type State = z.infer<typeof schema>
const state = reactive<State>({
  name: '',
  description: '',
  purpose: '',
  industry: '',
  logoUrl: '',
  cardStyle: 'cover',
})

const cardStyleOptions = [
  { value: 'cover' as const, label: 'Обложка', hint: 'Логотип на всю карточку' },
  { value: 'compact' as const, label: 'Компактный', hint: 'Логотип в углу' },
]

watch(
  workspace,
  (w) => {
    if (!w) return
    state.name = w.name
    state.description = w.description ?? ''
    state.purpose = w.purpose ?? ''
    state.industry = w.industry ?? ''
    state.logoUrl = w.logoUrl ?? ''
    state.cardStyle = w.cardStyle ?? 'cover'
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
      cardStyle: state.cardStyle,
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
  <div class="max-w-5xl mx-auto py-8 px-4">
    <div class="flex items-start justify-between gap-4 mb-8">
      <div class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight text-default">Настройки команды (в разработке)</h1>
        <p class="text-sm text-muted">Профиль и описание workspace'а</p>
      </div>
      <WorkspaceMemberRoleBadge v-if="workspace" :role="workspace.role" />
    </div>

    <div v-if="list.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="workspace && canEdit"
      class="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start"
    >
      <div class="surface-elevated rounded-2xl p-6 text-center lg:sticky lg:top-6">
        <div class="brand-gradient mx-auto size-24 rounded-2xl p-[3px]">
          <div class="size-full rounded-2xl overflow-hidden bg-default grid place-items-center text-2xl font-semibold text-default">
            <img
              v-if="state.logoUrl"
              :src="state.logoUrl"
              alt=""
              class="size-full object-cover"
            >
            <span v-else>{{ state.name.slice(0, 1).toUpperCase() || '∗' }}</span>
          </div>
        </div>

        <p class="mt-4 text-lg font-semibold text-default truncate">{{ state.name || 'Без названия' }}</p>
        <p class="text-xs font-mono text-muted truncate">{{ workspace.slug }}</p>

        <div
          v-if="state.industry"
          class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-muted"
        >
          <UIcon name="i-lucide-briefcase" class="size-3.5" />
          {{ state.industry }}
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3 text-left">
          <div class="rounded-xl bg-elevated px-3 py-2.5">
            <p class="text-xl font-bold text-default leading-none">{{ membersCount }}</p>
            <p class="mt-1 text-[11px] text-muted">{{ membersWord }}</p>
          </div>
          <div class="rounded-xl bg-elevated px-3 py-2.5">
            <p class="text-sm font-semibold text-default leading-tight">{{ createdLabel ?? '—' }}</p>
            <p class="mt-1 text-[11px] text-muted">создана</p>
          </div>
        </div>
      </div>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-6"
        @submit="onSubmit"
      >
        <div class="surface rounded-2xl p-6">
          <h2 class="font-semibold text-default mb-4">Общая информация</h2>
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
        </div>

        <div class="surface rounded-2xl p-6">
          <h2 class="font-semibold text-default mb-1">Вид карточки</h2>
          <p class="text-xs text-muted mb-4">Как workspace выглядит в списке воркспейсов</p>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="opt in cardStyleOptions"
              :key="opt.value"
              type="button"
              class="rounded-xl border p-3 text-left transition-colors"
              :class="state.cardStyle === opt.value
                ? 'border-accent-400 bg-accent-50 dark:bg-accent-950'
                : 'border-default hover:border-accent-300'"
              @click="state.cardStyle = opt.value"
            >
              <div class="brand-gradient relative mb-2 h-16 w-full overflow-hidden rounded-lg">
                <template v-if="opt.value === 'cover'">
                  <div class="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/70 to-transparent" />
                  <div class="absolute inset-x-2 bottom-1.5 space-y-1">
                    <div class="h-1.5 w-1/2 rounded-full bg-white/80" />
                    <div class="h-1 w-1/3 rounded-full bg-white/50" />
                  </div>
                </template>
                <template v-else>
                  <div class="absolute inset-0 bg-default" />
                  <div class="brand-gradient absolute left-2 top-2 size-6 rounded-md" />
                  <div class="absolute right-2 top-3 left-10 space-y-1">
                    <div class="h-1.5 w-2/3 rounded-full bg-accented" />
                    <div class="h-1 w-1/2 rounded-full bg-accented" />
                  </div>
                </template>
              </div>
              <p class="text-sm font-medium text-default">{{ opt.label }}</p>
              <p class="text-xs text-muted">{{ opt.hint }}</p>
            </button>
          </div>
        </div>

        <div class="surface rounded-2xl p-6">
          <h2 class="font-semibold text-default mb-4">О команде</h2>
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
        </div>

        <div class="flex justify-end">
          <UButton type="submit" :loading="update.isPending.value">
            Сохранить
          </UButton>
        </div>
      </UForm>
    </div>
  </div>
</template>
