<script setup lang="ts">
const colorMode = useColorMode()
const { resetHints } = useHints()
const toast = useToast()

const themes = [
  { value: 'light', label: 'Светлая', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Тёмная', icon: 'i-lucide-moon' },
  { value: 'system', label: 'Системная', icon: 'i-lucide-monitor' },
]

async function onResetHints() {
  try {
    await resetHints.mutateAsync()
    toast.add({
      title: 'Подсказки снова появятся',
      color: 'success',
      icon: 'i-lucide-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сбросить подсказки'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <div class="space-y-4">
    <section class="surface-soft rounded-2xl p-5">
      <h2 class="mb-1 font-semibold text-default">Тема оформления</h2>
      <p class="mb-4 text-xs text-muted">Выбор сохраняется в этом браузере</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="t in themes"
          :key="t.value"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
          :class="colorMode.preference === t.value
            ? 'border-accent-400 bg-accent-50 text-default dark:bg-accent-950'
            : 'border-default text-muted hover:border-accent-300 hover:text-default'"
          @click="colorMode.preference = t.value"
        >
          <UIcon :name="t.icon" class="size-4" />
          {{ t.label }}
        </button>
      </div>
    </section>

    <section class="surface-soft rounded-2xl p-5">
      <h2 class="mb-1 font-semibold text-default">Подсказки</h2>
      <p class="mb-4 text-xs text-muted">
        Вернуть обучающие блоки, которые вы закрыли: подсказки в симуляторе, на доске и в отчётах
      </p>
      <UButton
        size="sm"
        variant="outline"
        color="neutral"
        :loading="resetHints.isPending.value"
        @click="onResetHints"
      >
        Показать подсказки заново
      </UButton>
    </section>
  </div>
</template>
