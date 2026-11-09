<script setup lang="ts">
import { DEFAULT_DIGEST_HOUR, DEFAULT_EMAIL_PREFS, INSTANT_NOTIFICATION_TYPES, type InstantNotificationType, type NotificationType } from '#shared/types/notification'
import type { UpdateUserProfileInput } from '#shared/types/auth'
import {
  cellEnabled,
  detectMode,
  MATRIX_ROWS,
  matrixForMode,
  pachcaCellState,
  type ChannelMatrix,
  type MatrixGroup,
  type NotificationMode,
} from '#shared/utils/notification-modes'
import { pageRoutes } from '~/routing'

const MODES: { value: NotificationMode, label: string, hint: string }[] = [
  { value: 'all', label: 'Всё', hint: 'каждое событие' },
  { value: 'important', label: 'Важное', hint: 'про меня и поток' },
  { value: 'mine', label: 'Только про меня', hint: 'упоминания и назначения' },
  { value: 'quiet', label: 'Тишина', hint: 'только дайджест' },
]
const GROUPS: MatrixGroup[] = ['Про меня', 'Поток', 'Наблюдаю', 'Система']

const { me, update } = useProfileApi()
const { links: linksQuery, update: updateLinks } = useMyPachcaLinksApi()
const { current: workspace } = useCurrentWorkspace()
const toast = useToast()

const prefs = computed(() => me.data.value?.user.notificationPrefs ?? {})
const emailPrefs = computed(() => ({ ...DEFAULT_EMAIL_PREFS, ...me.data.value?.user.emailPrefs }))
const links = computed(() => linksQuery.data.value?.links ?? [])
const hasPachca = computed(() => links.value.length > 0)

const matrix = computed<ChannelMatrix>(() => ({
  bell: Object.fromEntries(MATRIX_ROWS.map(r => [r.type, prefs.value[r.type] !== false])) as ChannelMatrix['bell'],
  email: emailPrefs.value.instant,
  pachca: INSTANT_NOTIFICATION_TYPES.filter(t => pachcaCellState(links.value, t) === 'on'),
}))
const mode = computed(() => detectMode(matrix.value, { ignorePachca: !hasPachca.value }))
const manualOpen = ref(false)

function fail(err: unknown) {
  toast.add({ title: getErrorMessage(err, 'Не удалось сохранить'), color: 'error', icon: 'i-hugeicons-alert-circle' })
}

function saveProfile(patch: UpdateUserProfileInput) {
  update.mutate(patch, { onError: fail })
}

function savePachca(instantTypes: InstantNotificationType[]) {
  if (hasPachca.value) updateLinks.mutate({ instantTypes }, { onError: fail })
}

function applyMode(next: NotificationMode) {
  const m = matrixForMode(next, matrix.value)
  saveProfile({ notificationPrefs: m.bell, emailPrefs: { ...emailPrefs.value, instant: m.email } })
  savePachca(m.pachca)
}

function isInstant(type: NotificationType): type is InstantNotificationType {
  return (INSTANT_NOTIFICATION_TYPES as readonly string[]).includes(type)
}

function toggled<T>(list: T[], item: T, on: boolean): T[] {
  return on ? [...new Set([...list, item])] : list.filter(x => x !== item)
}

function setBell(type: NotificationType, on: boolean) {
  saveProfile({ notificationPrefs: { ...prefs.value, [type]: on } })
}

function setEmail(type: InstantNotificationType, on: boolean) {
  saveProfile({ emailPrefs: { ...emailPrefs.value, instant: toggled(emailPrefs.value.instant, type, on) } })
}

function setPachca(type: InstantNotificationType, on: boolean) {
  savePachca(toggled(matrix.value.pachca, type, on))
}

const TZ_SYNCED_KEY = 'scrumban:tz-synced'
const HOURS = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, value: h }))
const timeZones = Intl.supportedValuesOf('timeZone').map(tz => ({ label: tz.replaceAll('_', ' '), value: tz }))
const timeZone = computed(() => me.data.value?.user.timeZone ?? 'Europe/Moscow')
const digestHour = computed(() => emailPrefs.value.digestHour ?? DEFAULT_DIGEST_HOUR)
const pachcaDigest = computed(() => links.value.some(l => l.digest))

watch(() => me.data.value?.user.timeZone, (tz) => {
  if (!tz) return
  try {
    if (localStorage.getItem(TZ_SYNCED_KEY)) return
    localStorage.setItem(TZ_SYNCED_KEY, '1')
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz === 'Europe/Moscow' && browser && browser !== tz) saveProfile({ timeZone: browser })
  }
  catch {
    // Storage blocked: skip the one-off sync, the user can pick the zone by hand.
  }
}, { immediate: true })

function pachcaValue(type: InstantNotificationType): boolean | 'indeterminate' {
  const state = pachcaCellState(links.value, type)
  return state === 'mixed' ? 'indeterminate' : state === 'on'
}
</script>

<template>
  <div class="space-y-4">
    <SettingsTile title="Сколько шума ты готов терпеть?" description="Режим настраивает всё разом, тонкая настройка – ниже">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          v-for="m in MODES"
          :key="m.value"
          type="button"
          class="rounded-xl border px-3 py-3 text-left transition-colors"
          :class="mode === m.value ? 'border-accent-500 bg-accent-500/10' : 'border-default hover:bg-elevated'"
          :aria-pressed="mode === m.value"
          @click="applyMode(m.value)"
        >
          <span class="block text-sm font-semibold text-default">{{ m.label }}</span>
          <span class="block text-xs text-muted">{{ m.hint }}</span>
        </button>
      </div>
      <p v-if="mode === 'custom'" class="mt-3 text-xs text-muted">Сейчас свой набор – собран вручную в таблице ниже.</p>

      <UCollapsible v-model:open="manualOpen" class="mt-4 border-t border-default pt-3">
        <UButton
          variant="link"
          color="neutral"
          class="px-0"
          :trailing-icon="manualOpen ? 'i-hugeicons-arrow-up-01' : 'i-hugeicons-arrow-down-01'"
        >
          Настроить вручную
        </UButton>

        <template #content>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[480px] text-sm">
              <thead>
                <tr class="text-xs text-muted">
                  <th class="py-2 text-left font-medium" />
                  <th class="w-24 py-2 font-medium">В Такте</th>
                  <th class="w-24 py-2 font-medium">Почта</th>
                  <th v-if="hasPachca" class="w-24 py-2 font-medium">Пачка</th>
                </tr>
              </thead>
              <tbody v-for="group in GROUPS" :key="group">
                <tr>
                  <td colspan="4" class="pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted">{{ group }}</td>
                </tr>
                <tr v-for="row in MATRIX_ROWS.filter(r => r.group === group)" :key="row.type" class="border-t border-default">
                  <td class="py-2 pr-3 text-default">{{ row.label }}</td>
                  <td class="text-center">
                    <UCheckbox
                      class="inline-flex"
                      :model-value="matrix.bell[row.type]"
                      :aria-label="`${row.label}: в Такте`"
                      @update:model-value="setBell(row.type, $event === true)"
                    />
                  </td>
                  <td class="text-center">
                    <template v-if="isInstant(row.type)">
                      <UTooltip :text="cellEnabled(matrix, row.type, 'email') ? undefined : 'Сначала включи в Такте'" :disabled="cellEnabled(matrix, row.type, 'email')">
                        <UCheckbox
                          class="inline-flex"
                          :model-value="matrix.email.includes(row.type)"
                          :disabled="!cellEnabled(matrix, row.type, 'email')"
                          :aria-label="`${row.label}: почта`"
                          @update:model-value="setEmail(row.type, $event === true)"
                        />
                      </UTooltip>
                    </template>
                    <span v-else class="text-dimmed">–</span>
                  </td>
                  <td v-if="hasPachca" class="text-center">
                    <template v-if="isInstant(row.type)">
                      <UTooltip :text="cellEnabled(matrix, row.type, 'pachca') ? undefined : 'Сначала включи в Такте'" :disabled="cellEnabled(matrix, row.type, 'pachca')">
                        <UCheckbox
                          class="inline-flex"
                          :model-value="pachcaValue(row.type)"
                          :disabled="!cellEnabled(matrix, row.type, 'pachca')"
                          :aria-label="`${row.label}: Пачка`"
                          @update:model-value="setPachca(row.type, $event === true)"
                        />
                      </UTooltip>
                    </template>
                    <span v-else class="text-dimmed">–</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-3 text-xs text-muted">
            Письма приходят на {{ me.data.value?.user.email }}, только если почта подтверждена.
            <template v-if="!hasPachca && workspace">
              Чтобы получать сообщения в Пачку,
              <NuxtLink :to="pageRoutes.workspaceSettings(workspace.id, 'integrations')" class="underline hover:text-default">привяжи себя в интеграциях</NuxtLink>.
            </template>
          </p>
        </template>
      </UCollapsible>
    </SettingsTile>

    <SettingsTile title="Утренний дайджест" description="Просрочки, сроки на сегодня, блокеры и непрочитанное. Без новостей письма не будет">
      <div class="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <UFormField label="Время">
          <USelect
            :model-value="digestHour"
            :items="HOURS"
            class="w-full"
            @update:model-value="saveProfile({ emailPrefs: { ...emailPrefs, digestHour: $event } })"
          />
        </UFormField>
        <UFormField label="Часовой пояс">
          <USelectMenu
            :model-value="timeZone"
            :items="timeZones"
            value-key="value"
            class="w-full"
            @update:model-value="(tz: string) => saveProfile({ timeZone: tz })"
          />
        </UFormField>
      </div>
      <div class="mt-4 space-y-3 border-t border-default pt-4">
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm text-default">На почту</span>
          <USwitch :model-value="emailPrefs.digest" @update:model-value="saveProfile({ emailPrefs: { ...emailPrefs, digest: $event } })" />
        </div>
        <div v-if="hasPachca" class="flex items-center justify-between gap-4">
          <span class="text-sm text-default">В Пачку</span>
          <USwitch :model-value="pachcaDigest" @update:model-value="updateLinks.mutate({ digest: $event }, { onError: fail })" />
        </div>
      </div>
    </SettingsTile>
  </div>
</template>
