<script setup lang="ts">
import { MotionConfig } from 'motion-v'
import { SHORTCUT_IDS } from '#shared/types/shortcuts'
import { pageHelp } from '~/utils/page-help'
import type { HelpTab } from '~/composables/useHelpPanel'

const { open, tab } = useHelpPanel()
const { prefs, combos, resetAll } = useShortcutPrefs()
const route = useRoute()

const help = computed(() => pageHelp(route.name?.toString()))
const hasCustom = computed(() => Object.keys(prefs.value).length > 0)

const tabs: { value: HelpTab, label: string, icon: string }[] = [
  { value: 'page', label: 'Эта страница', icon: 'i-hugeicons-information-circle' },
  { value: 'keys', label: 'Горячие клавиши', icon: 'i-hugeicons-keyboard' },
]
</script>

<template>
  <USlideover v-model:open="open" side="right" title="Справка" :ui="{ content: 'max-w-md' }">
    <template #body>
      <MotionConfig reduced-motion="user">
        <div class="-mt-2 space-y-5">
          <UiUnderlineTabs v-model="tab" :items="tabs" label="Разделы справки" indicator-id="help-tab" />

          <div v-if="tab === 'page'" class="space-y-6">
            <section>
              <h3 class="mb-2 text-lg font-semibold text-highlighted">{{ help.title }}</h3>
              <ul class="space-y-2">
                <li v-for="tip in help.tips" :key="tip" class="flex gap-2.5 text-sm text-default">
                  <UIcon name="i-hugeicons-sparkles" class="mt-0.5 size-4 shrink-0 text-accent-500" />
                  <span>{{ tip }}</span>
                </li>
              </ul>
            </section>

            <section>
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dimmed">Быстрое действие</p>
              <div class="flex items-center justify-between rounded-xl bg-elevated px-3 py-2.5 text-sm">
                <span>Новая задача</span>
                <UiComboKeys :combo="combos.new_task" />
              </div>
            </section>

            <section>
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dimmed">Как это считается</p>
              <ul class="space-y-1">
                <li v-for="d in help.docs" :key="d.path">
                  <a
                    :href="d.path"
                    target="_blank"
                    rel="noopener"
                    class="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-elevated"
                  >
                    <UIcon name="i-hugeicons-book-open-01" class="size-4 shrink-0 text-muted" />
                    <span class="flex-1 text-default">{{ d.label }}</span>
                    <UIcon name="i-hugeicons-arrow-up-right-01" class="size-3.5 text-dimmed transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </li>
              </ul>
            </section>
          </div>

          <div v-else class="space-y-5">
            <div class="rounded-xl bg-elevated p-3 text-sm text-muted">
              <p>
                Сочетание вида <UiComboKeys combo="g-i" size="sm" /> нажимается по очереди: сначала
                <UKbd value="G" size="sm" />, отпустите, затем в течение секунды <UKbd value="I" size="sm" />.
                После первой клавиши внизу появится подсказка с вариантами.
              </p>
              <p class="mt-2">Клавиши не срабатывают, пока курсор в поле ввода. Раскладка не важна.</p>
            </div>

            <ul class="space-y-1">
              <li class="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted">Поиск и команды</p>
                  <p class="text-xs text-dimmed">везде</p>
                </div>
                <UiComboKeys combo="meta_k" />
              </li>
              <li class="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted">Эта справка</p>
                  <p class="text-xs text-dimmed">везде</p>
                </div>
                <UKbd value="?" />
              </li>
              <HelpShortcutRow v-for="id in SHORTCUT_IDS" :id="id" :key="id" />
            </ul>

            <UButton
              v-if="hasCustom"
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-hugeicons-undo-02"
              @click="resetAll()"
            >
              Сбросить все сочетания
            </UButton>
          </div>
        </div>
      </MotionConfig>
    </template>
    <template #footer>
      <a href="/docs" target="_blank" rel="noopener" class="flex w-full items-center gap-2 text-sm text-muted transition-colors hover:text-default">
        <UIcon name="i-hugeicons-book-open-01" class="size-4" />
        Вся документация
        <UIcon name="i-hugeicons-arrow-up-right-01" class="ml-auto size-3.5" />
      </a>
    </template>
  </USlideover>
</template>
