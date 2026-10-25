<script setup lang="ts">
import type { MemberView } from '#shared/types/workspace'
import type { RetroNote, RetroPhase } from '~/composables/api/useSprintRetroApi'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  note: RetroNote
  author: MemberView | null
  phase: RetroPhase
  tone: 'good' | 'improve'
  canVote: boolean
  votesLeft: number
  canManage: boolean
  wsId: string
  boardId: string
}>()
const emit = defineEmits<{ vote: [on: boolean], save: [body: string], remove: [] }>()

const editing = ref(false)
const draft = ref('')

function startEdit() {
  draft.value = props.note.body
  editing.value = true
}

function save() {
  const body = draft.value.trim()
  if (!body) return
  emit('save', body)
  editing.value = false
}

const voteDisabled = computed(() => !props.canVote || (!props.note.votedByMe && props.votesLeft === 0))
</script>

<template>
  <div
    :class="[
      'group rounded-xl border px-3 py-2.5 transition-colors',
      tone === 'good' ? 'border-emerald-500/15 bg-emerald-500/[0.06]' : 'border-accent-500/15 bg-accent-500/[0.06]',
    ]"
  >
    <div v-if="editing" class="space-y-2">
      <UTextarea v-model="draft" :rows="2" autoresize autofocus class="w-full" @keydown.enter.exact.prevent="save" @keydown.esc="editing = false" />
      <div class="flex justify-end gap-1.5">
        <UButton size="xs" variant="ghost" color="neutral" @click="editing = false">Отмена</UButton>
        <UButton size="xs" @click="save">Сохранить</UButton>
      </div>
    </div>
    <template v-else>
      <p class="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed text-default">{{ note.body }}</p>
      <div class="mt-2 flex items-center gap-2">
        <UserAvatar :user="author" size="xs" />
        <span class="min-w-0 flex-1 truncate text-[11.5px] text-muted">{{ author ? displayName(author) : 'Удалённый участник' }}</span>
        <NuxtLink
          v-if="note.taskId"
          :to="pageRoutes.task(wsId, boardId, note.taskId)"
          class="inline-flex items-center gap-1 text-[11px] text-muted hover:text-default"
        >
          <UIcon name="i-hugeicons-link-01" class="size-3" />
          задача
        </NuxtLink>
        <UDropdownMenu
          v-if="canManage"
          :items="[[
            { label: 'Изменить', icon: 'i-hugeicons-pencil-edit-02', onSelect: startEdit },
            { label: 'Удалить', icon: 'i-hugeicons-delete-02', color: 'error', onSelect: () => emit('remove') },
          ]]"
        >
          <button type="button" class="grid size-6 place-items-center rounded-md text-dimmed opacity-0 transition-opacity hover:bg-elevated hover:text-default group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label="Действия с заметкой">
            <UIcon name="i-hugeicons-more-horizontal" class="size-3.5" />
          </button>
        </UDropdownMenu>
        <button
          v-if="phase === 'discuss'"
          type="button"
          :disabled="voteDisabled"
          :aria-pressed="note.votedByMe"
          :title="note.votedByMe ? 'Снять голос' : (voteDisabled && canVote ? 'Голоса закончились' : 'Голос за обсуждение')"
          :class="[
            'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold tabular-nums transition-colors',
            note.votedByMe ? 'bg-accent-500 text-white' : 'bg-default text-muted ring-1 ring-default',
            voteDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:text-default',
          ]"
          @click="emit('vote', !note.votedByMe)"
        >
          <UIcon name="i-hugeicons-arrow-up-02" class="size-3.5" />
          {{ note.voteCount }}
        </button>
      </div>
    </template>
  </div>
</template>
