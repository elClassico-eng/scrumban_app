<script setup lang="ts">
import type { ShortcutId } from '#shared/types/shortcuts'
import { comboFromStrokes, conflictOf, isReserved, keyOf, SHORTCUT_DEFS, type KeyStroke } from '~/utils/shortcuts'

const props = defineProps<{ id: ShortcutId }>()

const { prefs, combos, setCombo } = useShortcutPrefs()
const def = computed(() => SHORTCUT_DEFS[props.id])
const custom = computed(() => props.id in prefs.value)

const recording = ref(false)
const error = ref<string | null>(null)
const strokes: KeyStroke[] = []
let finishTimer: ReturnType<typeof setTimeout> | undefined

const CHAIN_WAIT_MS = 900

function start() {
  strokes.length = 0
  error.value = null
  recording.value = true
}

function finish() {
  clearTimeout(finishTimer)
  recording.value = false
  const combo = comboFromStrokes(strokes)
  if (!combo) {
    error.value = 'Можно использовать буквы и цифры, с модификаторами или парой клавиш подряд.'
    return
  }
  if (isReserved(combo)) {
    error.value = 'Это сочетание занято браузером или поиском, выберите другое.'
    return
  }
  const clash = conflictOf(props.id, combo, prefs.value)
  if (clash) {
    error.value = `Уже занято: «${SHORTCUT_DEFS[clash].label}».`
    return
  }
  setCombo(props.id, combo === def.value.combo ? null : combo)
}

function onKey(e: KeyboardEvent) {
  if (!recording.value) return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') {
    clearTimeout(finishTimer)
    recording.value = false
    return
  }
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return
  strokes.push({ code: e.code, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey })
  const plainFirst = strokes.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && keyOf(e.code)
  if (plainFirst) {
    finishTimer = setTimeout(finish, CHAIN_WAIT_MS)
    return
  }
  finish()
}

useEventListener(window, 'keydown', onKey, { capture: true })
onBeforeUnmount(() => clearTimeout(finishTimer))
</script>

<template>
  <li class="rounded-xl px-3 py-2.5 transition-colors hover:bg-elevated">
    <div class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-highlighted">{{ def.label }}</p>
        <p class="text-xs text-dimmed">{{ def.where }}{{ custom ? ' · своё сочетание' : '' }}</p>
      </div>
      <span v-if="recording" class="animate-pulse text-xs font-medium text-accent-600 dark:text-accent-400">
        Нажмите клавиши… Esc – отмена
      </span>
      <UiComboKeys v-else :combo="combos[id]" />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="recording ? 'i-hugeicons-cancel-01' : 'i-hugeicons-pencil-edit-02'"
        :aria-label="recording ? 'Отменить запись' : 'Изменить сочетание'"
        @click="recording ? (recording = false) : start()"
      />
      <UButton
        v-if="custom && !recording"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-hugeicons-undo-02"
        aria-label="Вернуть по умолчанию"
        @click="setCombo(id, null)"
      />
    </div>
    <p v-if="error" class="mt-1.5 text-xs text-error">{{ error }}</p>
  </li>
</template>
