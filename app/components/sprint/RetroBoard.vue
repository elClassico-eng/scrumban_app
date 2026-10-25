<script setup lang="ts">
import type { SprintReportPayload } from '#shared/types/sprint-report'
import type { MemberView } from '#shared/types/workspace'
import type { RetroCategory, RetroNote } from '~/composables/api/useSprintRetroApi'

const props = defineProps<{
  wsId: string
  boardId: string
  sprintId: string
  payload: SprintReportPayload | null
  prevSprintId: string | null
}>()

const retro = useSprintRetroApi(
  computed(() => props.wsId),
  computed(() => props.boardId),
  computed(() => props.sprintId),
  { live: true },
)
const prevRetro = useSprintRetroApi(
  computed(() => props.wsId),
  computed(() => props.boardId),
  computed(() => props.prevSprintId ?? ''),
)

const { list: membersList } = useMembersApi(computed(() => props.wsId))
const { list: workspacesList } = useWorkspacesApi()
const authStore = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const members = computed<MemberView[]>(() => membersList.data.value?.members ?? [])
const role = computed(() => workspacesList.data.value?.workspaces.find(w => w.id === props.wsId)?.role)
const canWrite = computed(() => hasRole(role.value, 'member'))
const canFacilitate = computed(() => hasRole(role.value, 'scrum_master'))
const isAdmin = computed(() => hasRole(role.value, 'admin'))
const myId = computed(() => authStore.user?.id ?? null)

const phase = computed(() => retro.board.data.value?.phase ?? 'collect')
const votesLeft = computed(() => retro.board.data.value?.myVotesLeft ?? 0)

const OPINIONS = [
  { category: 'went_well' as const, title: 'Что было хорошо', icon: 'i-hugeicons-thumbs-up', tone: 'good' as const, placeholder: 'Что сработало и стоит сохранить' },
  { category: 'to_improve' as const, title: 'Что улучшить', icon: 'i-hugeicons-wrench-01', tone: 'improve' as const, placeholder: 'Что мешало или тормозило' },
]

function authorOf(id: string | null) {
  return members.value.find(m => m.userId === id) ?? null
}

function canManage(note: RetroNote) {
  return isAdmin.value || (note.authorId !== null && note.authorId === myId.value)
}

function visible(category: RetroCategory) {
  const list = retro.notes.value.filter(n => n.category === category && !n.hidden)
  return phase.value === 'discuss' ? [...list].sort((a, b) => b.voteCount - a.voteCount) : list
}

function hiddenAuthors(category: RetroCategory) {
  const hidden = retro.notes.value.filter(n => n.category === category && n.hidden)
  const ids = [...new Set(hidden.map(n => n.authorId))]
  return { count: hidden.length, authors: ids.map(authorOf).filter((m): m is MemberView => m !== null) }
}

const actions = computed(() => retro.notes.value.filter(n => n.category === 'action_item'))

const drafts = reactive<Record<RetroCategory, string>>({ went_well: '', to_improve: '', action_item: '' })

function fail(err: unknown, fallback: string) {
  toast.add({ title: getErrorMessage(err, fallback), color: 'error', icon: 'i-hugeicons-alert-circle' })
}

async function add(category: RetroCategory, body = drafts[category]) {
  const text = body.trim()
  if (!text) return
  try {
    await retro.create.mutateAsync({ category, body: text })
    if (body === drafts[category]) drafts[category] = ''
  }
  catch (err) {
    fail(err, 'Не удалось добавить заметку')
  }
}

async function remove(note: RetroNote) {
  const ok = await confirm({ title: 'Удалить заметку?', description: note.body.slice(0, 120), confirmLabel: 'Удалить', confirmColor: 'error' })
  if (!ok) return
  retro.remove.mutate(note.id, { onError: err => fail(err, 'Не удалось удалить') })
}

function patch(note: RetroNote, data: { body?: string, isResolved?: boolean, assigneeId?: string | null, dueDate?: string | null }) {
  retro.update.mutate({ noteId: note.id, ...data }, { onError: err => fail(err, 'Не удалось сохранить') })
}

function vote(note: RetroNote, on: boolean) {
  retro.vote.mutate({ noteId: note.id, on }, { onError: err => fail(err, 'Не удалось проголосовать') })
}

async function convert(note: RetroNote) {
  try {
    const res = await retro.convert.mutateAsync(note.id)
    toast.add({
      title: res.addedToSprintId ? 'Задача создана и добавлена в следующий спринт' : 'Задача создана в бэклоге',
      icon: 'i-hugeicons-task-done-01',
    })
  }
  catch (err) {
    fail(err, 'Не удалось создать задачу')
  }
}

function openNotes() {
  retro.setPhase.mutate('discuss', { onError: err => fail(err, 'Не удалось открыть заметки') })
}

function backToCollect() {
  retro.setPhase.mutate('collect', { onError: err => fail(err, 'Не удалось вернуть сбор') })
}

const facts = computed(() => {
  const p = props.payload
  if (!p) return []
  const out: { icon: string, text: string, warn: boolean }[] = []
  if (p.goal.achieved === false) out.push({ icon: 'i-hugeicons-target-02', text: 'Цель спринта не достигнута', warn: true })
  if (p.totals.startCount > 0) {
    const share = Math.round((p.totals.addedAfterStartCount / p.totals.startCount) * 100)
    if (share >= 20) out.push({ icon: 'i-hugeicons-triangle-alert', text: `${share}% задач добавили после старта – скоуп менялся сильнее нормы`, warn: true })
  }
  for (const c of p.carryOver.filter(x => x.streak >= 2)) {
    out.push({ icon: 'i-hugeicons-repeat', text: `«${c.title}» переносится ${c.streak}-й спринт подряд`, warn: true })
  }
  if (p.totals.carryOverCount > 0) {
    out.push({ icon: 'i-hugeicons-corner-down-right', text: `Перенесено ${p.totals.carryOverCount} задач (${p.totals.carryOverSp} SP)`, warn: false })
  }
  if (p.flow.cycleP85 !== null) {
    out.push({ icon: 'i-hugeicons-timer-02', text: `Время цикла P85 – ${p.flow.cycleP85} дн, медиана – ${p.flow.cycleP50 ?? '–'} дн`, warn: false })
  }
  return out
})

const prevActions = computed(() => (prevRetro.notes.value).filter(n => n.category === 'action_item'))
const prevDone = computed(() => prevActions.value.filter(n => n.isResolved).length)
</script>

<template>
  <div class="space-y-5">
    <section class="surface flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl px-5 py-4">
      <ol class="flex items-center gap-2 text-[13px]">
        <li :class="['flex items-center gap-2', phase === 'collect' ? 'font-semibold text-highlighted' : 'text-muted']">
          <span :class="['grid size-6 place-items-center rounded-full text-[11px] font-bold', phase === 'collect' ? 'bg-accent-500 text-white' : 'bg-elevated text-muted']">1</span>
          Сбор мыслей
        </li>
        <UIcon name="i-hugeicons-arrow-right-02" class="size-4 text-dimmed" />
        <li :class="['flex items-center gap-2', phase === 'discuss' ? 'font-semibold text-highlighted' : 'text-muted']">
          <span :class="['grid size-6 place-items-center rounded-full text-[11px] font-bold', phase === 'discuss' ? 'bg-accent-500 text-white' : 'bg-elevated text-muted']">2</span>
          Обсуждение
        </li>
      </ol>
      <p class="m-0 min-w-56 flex-1 text-[12.5px] text-muted">
        <template v-if="phase === 'collect'">
          Каждый пишет своё, чужие заметки скрыты до обсуждения, чтобы никто не подстраивался.
        </template>
        <template v-else>
          Голосуйте за то, что обсудить первым, и записывайте решения в «Действия».
        </template>
      </p>
      <div v-if="phase === 'discuss' && canWrite" class="flex items-center gap-1.5 text-[12px] text-muted" :title="`Осталось голосов: ${votesLeft}`">
        Голоса
        <span v-for="i in 3" :key="i" :class="['size-2.5 rounded-full', i <= votesLeft ? 'bg-accent-500' : 'bg-accented']" />
      </div>
      <template v-if="canFacilitate">
        <UButton v-if="phase === 'collect'" icon="i-hugeicons-view" :loading="retro.setPhase.isPending.value" @click="openNotes">
          Открыть заметки
        </UButton>
        <UButton v-else size="sm" variant="ghost" color="neutral" icon="i-hugeicons-undo-02" @click="backToCollect">
          Вернуть сбор
        </UButton>
      </template>
      <p v-else-if="phase === 'collect'" class="m-0 text-[12px] text-dimmed">Заметки откроет скрам-мастер</p>
    </section>

    <section v-if="facts.length" class="space-y-2.5">
      <h3 class="m-0 text-[11px] font-semibold uppercase tracking-wider text-dimmed">Факты спринта – с чего начать разговор</h3>
      <div class="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="f in facts" :key="f.text" class="surface flex items-start gap-3 rounded-xl px-3.5 py-3">
          <UIcon :name="f.icon" :class="['mt-0.5 size-4 shrink-0', f.warn ? 'text-accent-600' : 'text-muted']" />
          <span class="flex-1 text-[13px] text-default">{{ f.text }}</span>
          <UButton
            v-if="canWrite"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-hugeicons-plus"
            title="Добавить в «Что улучшить»"
            aria-label="Добавить в «Что улучшить»"
            @click="add('to_improve', f.text)"
          />
        </div>
      </div>
    </section>

    <section v-if="prevActions.length" class="surface rounded-2xl px-5 py-4">
      <div class="mb-2.5 flex items-center gap-2">
        <h3 class="m-0 text-[13px] font-semibold text-highlighted">Действия прошлой ретро</h3>
        <span :class="['rounded-full px-2 py-0.5 text-[11px] font-semibold', prevDone === prevActions.length ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-accent-500/10 text-accent-700 dark:text-accent-300']">
          выполнено {{ prevDone }} из {{ prevActions.length }}
        </span>
      </div>
      <ul class="space-y-1.5">
        <li v-for="n in prevActions" :key="n.id" class="flex items-center gap-2.5 text-[13px]">
          <UCheckbox
            :model-value="n.isResolved"
            :disabled="!canWrite"
            @update:model-value="prevRetro.update.mutate({ noteId: n.id, isResolved: Boolean($event) })"
          />
          <span :class="n.isResolved ? 'text-muted line-through' : 'text-default'">{{ n.body }}</span>
        </li>
      </ul>
    </section>

    <div class="grid items-start gap-4 lg:grid-cols-2">
      <section v-for="col in OPINIONS" :key="col.category" class="surface space-y-3 rounded-2xl p-4">
        <header class="flex items-center gap-2.5">
          <span :class="['grid size-7 place-items-center rounded-lg', col.tone === 'good' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-accent-500/10 text-accent-600']">
            <UIcon :name="col.icon" class="size-4" />
          </span>
          <h3 class="m-0 flex-1 text-[14px] font-semibold text-highlighted">{{ col.title }}</h3>
          <span class="text-[12px] tabular-nums text-dimmed">{{ retro.notes.value.filter(n => n.category === col.category).length }}</span>
        </header>

        <UInput
          v-if="canWrite"
          v-model="drafts[col.category]"
          class="w-full"
          icon="i-hugeicons-plus"
          :placeholder="`${col.placeholder}. Enter – добавить`"
          @keydown.enter.prevent="add(col.category)"
        />

        <div
          v-if="hiddenAuthors(col.category).count"
          class="flex items-center gap-2.5 rounded-xl border border-dashed border-default px-3 py-2.5 text-[12.5px] text-muted"
        >
          <div class="flex -space-x-1.5">
            <UserAvatar v-for="m in hiddenAuthors(col.category).authors" :key="m.userId" :user="m" size="xs" ring />
          </div>
          Ещё {{ hiddenAuthors(col.category).count }} скрыто до обсуждения
        </div>

        <div class="space-y-2">
          <SprintRetroNoteCard
            v-for="n in visible(col.category)"
            :key="n.id"
            :note="n"
            :author="authorOf(n.authorId)"
            :phase="phase"
            :tone="col.tone"
            :can-vote="canWrite"
            :votes-left="votesLeft"
            :can-manage="canManage(n)"
            :ws-id="wsId"
            :board-id="boardId"
            @vote="vote(n, $event)"
            @save="patch(n, { body: $event })"
            @remove="remove(n)"
          />
          <p v-if="!retro.notes.value.some(n => n.category === col.category)" class="py-3 text-center text-[12px] text-dimmed">
            Пока пусто
          </p>
        </div>
      </section>
    </div>

    <section class="surface overflow-hidden rounded-2xl">
      <header class="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4">
        <span class="grid size-7 place-items-center rounded-lg bg-inverted text-inverted">
          <UIcon name="i-hugeicons-task-done-01" class="size-4" />
        </span>
        <h3 class="m-0 text-[14px] font-semibold text-highlighted">Действия</h3>
        <p class="m-0 text-[12.5px] text-muted">Что команда сделает по-другому: с ответственным и сроком</p>
      </header>
      <div v-if="canWrite" class="px-5 pt-3">
        <UInput
          v-model="drafts.action_item"
          class="w-full"
          icon="i-hugeicons-plus"
          placeholder="Например: ревью не дольше суток. Enter – добавить"
          @keydown.enter.prevent="add('action_item')"
        />
      </div>
      <ul v-if="actions.length" class="mt-2 divide-y divide-default">
        <SprintRetroActionRow
          v-for="n in actions"
          :key="n.id"
          :note="n"
          :members="members"
          :can-write="canWrite"
          :can-manage="canManage(n)"
          :converting="retro.convert.isPending.value && retro.convert.variables.value === n.id"
          :ws-id="wsId"
          :board-id="boardId"
          @patch="patch(n, $event)"
          @convert="convert(n)"
          @remove="remove(n)"
        />
      </ul>
      <p v-else class="px-5 pb-5 pt-3 text-[12.5px] text-dimmed">
        Решений пока нет. Хорошее действие проверяемо: через спринт понятно, сделано или нет.
      </p>
      <div v-if="actions.length" class="h-2" />
    </section>
  </div>
</template>
