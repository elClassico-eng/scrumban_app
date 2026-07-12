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
    :ui="{ content: 'max-w-[1400px] w-[calc(100vw-4rem)] h-[min(820px,92dvh)] rounded-2xl overflow-hidden m-auto' }"
  >
    <template #content>
      <div class="grid grid-cols-1 lg:grid-cols-[2fr_3fr] h-full min-h-0">
        <aside class="relative hidden lg:flex flex-col bg-black text-white overflow-hidden">
          <div class="absolute -top-24 -right-20 size-80 rounded-full bg-accent-600/20 blur-3xl pointer-events-none" />
          <div class="absolute -bottom-32 -left-24 size-[24rem] rounded-full bg-[#c10801]/15 blur-3xl pointer-events-none" />

          <div class="relative flex items-center gap-3 px-10 pt-9">
            <div class="size-9 rounded-xl bg-white grid place-items-center shrink-0 shadow-lg shadow-black/30">
              <TaktMark class="size-6 text-black takt-mark--swing" />
            </div>
            <span class="text-[16px] font-semibold tracking-tight drop-shadow">Такт</span>
          </div>

          <div class="relative mt-auto px-10 pb-10 space-y-8">
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-400 mb-4">
                Мастер создания спринта
              </div>
              <Transition name="step-text" mode="out-in">
                <div :key="step">
                  <h2 class="text-[30px] font-semibold tracking-tight leading-[1.15] m-0 text-white text-balance">
                    {{ STEPS[step]!.heading }}
                  </h2>
                  <p class="text-[13.5px] text-white/65 leading-relaxed mt-3.5 m-0 max-w-md">
                    {{ STEPS[step]!.description }}
                  </p>
                </div>
              </Transition>
            </div>

            <div class="h-px bg-white/12" />

            <div class="space-y-0">
              <div
                v-for="(s, i) in STEPS"
                :key="s.title"
                class="relative flex items-center gap-3.5"
                :class="i < STEPS.length - 1 ? 'pb-5' : ''"
              >
                <div
                  v-if="i < STEPS.length - 1"
                  class="absolute left-[11px] top-7 bottom-1 w-px transition-colors"
                  :class="i < step ? 'bg-accent-500' : 'bg-white/15'"
                />
                <div
                  class="relative size-[23px] rounded-full grid place-items-center text-[11px] font-bold shrink-0 transition-all"
                  :class="i < step
                    ? 'bg-accent-500 text-white'
                    : i === step
                      ? 'bg-white text-black ring-4 ring-white/20'
                      : 'ring-1 ring-inset ring-white/30 text-white/50'"
                >
                  <UIcon v-if="i < step" name="i-lucide-check" class="size-3" />
                  <template v-else>{{ i + 1 }}</template>
                </div>
                <span
                  class="text-[13px] transition-colors"
                  :class="i === step ? 'text-white font-semibold' : i < step ? 'text-white/70 font-medium' : 'text-white/45 font-medium'"
                >
                  {{ s.title }}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <div class="flex flex-col min-h-0 bg-default">
          <div class="shrink-0 border-b border-default">
            <div class="max-w-[640px] mx-auto w-full flex items-center gap-3 px-6 pt-7 pb-5">
              <div>
                <div class="text-[11px] font-semibold text-muted tabular-nums">
                  Шаг {{ step + 1 }} из {{ STEPS.length }}
                </div>
                <h3 class="text-[18px] font-semibold tracking-tight m-0 mt-0.5">
                  {{ STEPS[step]!.title }}
                </h3>
              </div>
              <div class="flex-1" />
              <button
                type="button"
                class="size-8 rounded-lg grid place-items-center text-muted hover:bg-elevated hover:text-default transition-colors cursor-pointer"
                @click="open = false"
              >
                <UIcon name="i-lucide-x" class="size-4" />
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto">
            <div class="max-w-[640px] mx-auto w-full px-6 py-7">
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
          </div>

          <div class="shrink-0 border-t border-default">
            <div class="max-w-[640px] mx-auto w-full flex items-center gap-2.5 px-6 py-5">
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
