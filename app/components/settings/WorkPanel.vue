<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { SHORTCUT_IDS } from '#shared/types/shortcuts'
import type { BoardsListResponse } from '#shared/types/board'
import { apiRoutes, pageRoutes } from '~/routing'
import { START_PAGE_KEY } from '~/utils/home-redirect'

const { me, update } = useProfileApi()
const { list: workspacesList } = useWorkspacesApi()
const { prefs: shortcutPrefs, resetAll } = useShortcutPrefs()
const { resetHints } = useHints()
const toast = useToast()

const workspaces = computed(() => workspacesList.data.value?.workspaces ?? [])
const allBoards = useQuery({
  queryKey: computed(() => ['settings', 'all-boards', workspaces.value.map(w => w.id)]),
  enabled: computed(() => workspaces.value.length > 0),
  queryFn: () => Promise.all(workspaces.value.map(async ws => ({
    ws,
    boards: (await $fetch<BoardsListResponse>(apiRoutes.boards(ws.id))).boards,
  }))),
})

const boardItems = computed(() => {
  const groups = allBoards.data.value ?? []
  return groups.flatMap(({ ws, boards }) => boards.map(b => ({
    label: groups.length > 1 ? `${ws.name} · ${b.name}` : b.name,
    value: pageRoutes.board(ws.id, b.id),
  })))
})

const startPage = computed(() => me.data.value?.user.startPage ?? null)
const mode = computed(() => (startPage.value ? 'board' : 'last'))
const firstBoard = computed(() => boardItems.value[0])

watch(startPage, (path) => {
  try {
    if (path) localStorage.setItem(START_PAGE_KEY, path)
    else localStorage.removeItem(START_PAGE_KEY)
  }
  catch {
    // Storage blocked: the landing redirect falls back to the last path.
  }
}, { immediate: true })

function setStartPage(path: string | null) {
  update.mutate({ startPage: path }, {
    onError: err => toast.add({ title: getErrorMessage(err, 'Не удалось сохранить'), color: 'error', icon: 'i-hugeicons-alert-circle' }),
  })
}

function setMode(next: string) {
  if (next === 'last') setStartPage(null)
  else if (firstBoard.value) setStartPage(startPage.value ?? firstBoard.value.value)
}

const hasCustomShortcuts = computed(() => Object.keys(shortcutPrefs.value).length > 0)

async function onResetHints() {
  try {
    await resetHints.mutateAsync()
    toast.add({ title: 'Подсказки снова появятся', color: 'success', icon: 'i-hugeicons-checkmark-circle-02', duration: 1500 })
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось сбросить подсказки'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <SettingsTile title="Стартовая страница" description="Куда открывать Такт, когда заходишь на главную">
      <URadioGroup
        :model-value="mode"
        :items="[
          { label: 'Где остановился', description: 'Последняя открытая страница', value: 'last' },
          { label: 'Конкретная доска', description: 'Всегда начинать с одной доски', value: 'board', disabled: !firstBoard },
        ]"
        @update:model-value="setMode($event as string)"
      />
      <USelectMenu
        v-if="mode === 'board'"
        :model-value="startPage ?? undefined"
        :items="boardItems"
        value-key="value"
        class="mt-3 w-full sm:w-80"
        placeholder="Выбери доску"
        @update:model-value="(v: string) => setStartPage(v)"
      />
    </SettingsTile>

    <SettingsTile title="Горячие клавиши" description="Нажми на сочетание, чтобы назначить своё">
      <template #actions>
        <UButton v-if="hasCustomShortcuts" size="xs" variant="ghost" color="neutral" @click="resetAll">Сбросить всё</UButton>
      </template>
      <ul class="-mx-3 space-y-1">
        <HelpShortcutRow v-for="id in SHORTCUT_IDS" :id="id" :key="id" />
      </ul>
    </SettingsTile>

    <SettingsTile title="Подсказки" description="Вернуть обучающие блоки, которые ты закрыл: в симуляторе, на доске и в отчётах">
      <UButton variant="soft" color="neutral" :loading="resetHints.isPending.value" @click="onResetHints">
        Показать подсказки заново
      </UButton>
    </SettingsTile>
  </div>
</template>
