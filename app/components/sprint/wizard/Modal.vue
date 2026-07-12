<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'
import type { SprintPreviewReport } from '#shared/types/sprint'
import type { WizardBasics } from './StepBasics.vue'

const props = defineProps<{
  workspaceId: string
  boardId: string
  allTasks: Task[]
  columns: BoardColumn[]
  taskIdsInSprints: Set<string>
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()

const STEPS = [
  {
    title: 'Реквизиты',
    heading: 'Задайте рамку спринта',
    description: 'Название, цель одной фразой и временное окно. Цель зафиксируется на весь спринт — сформулируйте, зачем команда берёт эту итерацию.',
  },
  {
    title: 'Состав',
    heading: 'Соберите состав из бэклога',
    description: 'Отберите задачи и следите за полосой нагрузки. Мастер сам предупредит, если задача зависит от чего-то вне состава — блокер можно добавить одной кнопкой.',
  },
  {
    title: 'Прогноз',
    heading: 'Проверьте выполнимость до старта',
    description: 'Монте-Карло по сети зависимостей — 5000 симуляций на истории вашей команды. Вероятность, сроки P50/P85, критический путь и риски — до того, как спринт создан.',
  },
] as const

const step = ref(0)

const basics = ref<WizardBasics>({
  name: '',
  goal: '',
  plannedStartAt: '',
  plannedEndAt: '',
  capacity: null,
})
const selected = ref<Set<string>>(new Set())
const previewReport = ref<SprintPreviewReport | null>(null)

const basicsRef = ref<{ valid: boolean } | null>(null)

const { create, start } = useSprintsApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
)
const { preview } = useSprintPreviewApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
)

const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  step.value = 0
  basics.value = { name: '', goal: '', plannedStartAt: '', plannedEndAt: '', capacity: null }
  selected.value = new Set()
  previewReport.value = null
})

const candidates = computed(() =>
  filterSprintCandidates(props.allTasks, {
    excludeTaskIds: props.taskIdsInSprints,
    terminalColumnIds: terminalColumnIds(props.columns),
  }),
)

function toIsoOrNull(value: string): string | null {
  if (!value) return null
  return new Date(value + 'T00:00:00Z').toISOString()
}

async function runPreview() {
  if (selected.value.size === 0) {
    previewReport.value = null
    return
  }
  try {
    previewReport.value = await preview.mutateAsync({
      taskIds: [...selected.value],
      plannedStartAt: toIsoOrNull(basics.value.plannedStartAt),
      plannedEndAt: toIsoOrNull(basics.value.plannedEndAt),
    })
  }
  catch {
    previewReport.value = null
  }
}

watchDebounced(selected, runPreview, { debounce: 400 })

const stepValid = computed(() => {
  if (step.value === 0) return basicsRef.value?.valid ?? false
  if (step.value === 1) return selected.value.size > 0
  return true
})

function next() {
  if (!stepValid.value) return
  if (step.value === 1) runPreview()
  step.value = Math.min(step.value + 1, STEPS.length - 1)
}

function back() {
  step.value = Math.max(step.value - 1, 0)
}

const creating = ref(false)

async function createSprint(andStart: boolean) {
  if (creating.value) return
  creating.value = true
  try {
    const res = await create.mutateAsync({
      name: basics.value.name.trim(),
      goal: basics.value.goal.trim() || undefined,
      plannedStartAt: toIsoOrNull(basics.value.plannedStartAt),
      plannedEndAt: toIsoOrNull(basics.value.plannedEndAt),
      capacity: basics.value.capacity,
      taskIds: [...selected.value],
    })
    if (andStart) {
      await start.mutateAsync(res.sprint.id)
    }
    toast.add({
      title: andStart
        ? `Спринт «${res.sprint.name}» создан и запущен`
        : `Спринт «${res.sprint.name}» создан`,
      icon: andStart ? 'i-lucide-play' : 'i-lucide-check',
      duration: 2000,
    })
    emit('created')
    open.value = false
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось создать спринт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    fullscreen
    :ui="{ content: 'max-w-5xl h-[min(720px,92dvh)] rounded-2xl overflow-hidden m-auto' }"
  >
    <template #content>
      <div class="grid grid-cols-1 lg:grid-cols-2 h-full min-h-0">
        <aside class="relative hidden lg:flex flex-col bg-black text-white overflow-hidden">
          <img
            src="/img/sprint-bg.webp"
            alt=""
            class="absolute inset-0 size-full object-cover pointer-events-none select-none"
          >
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20 pointer-events-none" />
          <div class="absolute inset-0 bg-black/15 pointer-events-none" />

          <div class="relative flex items-center gap-2.5 px-8 pt-8 drop-shadow-sm">
            <TaktMark class="size-6 shrink-0 takt-mark--swing" />
            <span class="text-[15px] font-semibold tracking-tight">Такт</span>
          </div>

          <div class="relative flex-1 flex flex-col justify-center px-8 py-6">
            <div class="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80 mb-3">
              Мастер создания спринта
            </div>
            <Transition name="step-text" mode="out-in">
              <div :key="step">
                <h2 class="text-[26px] font-semibold tracking-tight leading-tight m-0 text-white">
                  {{ STEPS[step]!.heading }}
                </h2>
                <p class="text-[13px] text-white/75 leading-relaxed mt-3 m-0 max-w-xs">
                  {{ STEPS[step]!.description }}
                </p>
              </div>
            </Transition>
          </div>

          <div class="relative px-8 pb-8 space-y-1">
            <div
              v-for="(s, i) in STEPS"
              :key="s.title"
              class="flex items-center gap-3 py-2"
            >
              <div
                class="size-7 rounded-full grid place-items-center text-[12px] font-bold shrink-0 transition-colors"
                :class="i < step
                  ? 'bg-accent-500 text-white'
                  : i === step
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white/40'"
              >
                <UIcon v-if="i < step" name="i-lucide-check" class="size-3.5" />
                <template v-else>{{ i + 1 }}</template>
              </div>
              <span
                class="text-[13px] font-medium transition-colors"
                :class="i === step ? 'text-white' : i < step ? 'text-white/75' : 'text-white/45'"
              >
                {{ s.title }}
              </span>
            </div>
          </div>
        </aside>

        <div class="flex flex-col min-h-0 bg-default">
          <div class="flex items-center gap-3 px-6 lg:px-8 pt-6 pb-4 border-b border-default shrink-0">
            <div class="lg:hidden text-[12px] font-semibold text-muted">
              Шаг {{ step + 1 }} из {{ STEPS.length }}
            </div>
            <h3 class="hidden lg:block text-[16px] font-semibold tracking-tight m-0">
              {{ STEPS[step]!.title }}
            </h3>
            <div class="flex-1" />
            <button
              type="button"
              class="size-8 rounded-lg grid place-items-center text-muted hover:bg-elevated hover:text-default transition-colors cursor-pointer"
              @click="open = false"
            >
              <UIcon name="i-lucide-x" class="size-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
            <SprintWizardStepBasics v-if="step === 0" ref="basicsRef" v-model="basics" />
            <SprintWizardStepTasks
              v-else-if="step === 1"
              v-model="selected"
              :candidates="candidates"
              :all-tasks="allTasks"
              :capacity="basics.capacity"
              :external-risks="previewReport?.risks ?? []"
            />
            <SprintWizardStepForecast
              v-else
              v-model="selected"
              :report="previewReport"
              :pending="preview.isPending.value"
              :all-tasks="allTasks"
            />
          </div>

          <div class="flex items-center gap-2.5 px-6 lg:px-8 py-5 border-t border-default shrink-0">
            <UButton
              v-if="step > 0"
              size="lg"
              variant="ghost"
              color="neutral"
              icon="i-lucide-arrow-left"
              @click="back"
            >
              Назад
            </UButton>
            <div class="flex-1" />
            <template v-if="step < 2">
              <UButton
                size="lg"
                trailing-icon="i-lucide-arrow-right"
                :disabled="!stepValid"
                @click="next"
              >
                Далее
              </UButton>
            </template>
            <template v-else>
              <UButton
                size="lg"
                variant="outline"
                color="neutral"
                :loading="creating"
                @click="createSprint(false)"
              >
                Создать
              </UButton>
              <UButton
                size="lg"
                icon="i-lucide-play"
                :loading="creating"
                @click="createSprint(true)"
              >
                Создать и запустить
              </UButton>
            </template>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.step-text-enter-active,
.step-text-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.step-text-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.step-text-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
@media (prefers-reduced-motion: reduce) {
  .step-text-enter-active,
  .step-text-leave-active {
    transition: none;
  }
}
</style>
