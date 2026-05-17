<script setup lang="ts">
import type { Role } from '#shared/types/domain'
import { pageRoutes } from '~/routing'

const props = defineProps<{ workspaceId: string, workspaceName: string }>()
const open = defineModel<boolean>('open', { default: false })

type Mode = 'emails' | 'link'
type EmailChip = { value: string, valid: boolean }

const ROLE_OPTIONS: Array<{ value: Role }> = [
  { value: 'admin' },
  { value: 'scrum_master' },
  { value: 'member' },
  { value: 'viewer' },
]

const mode = ref<Mode>('emails')
const emails = ref<EmailChip[]>([])
const draft = ref('')
const role = ref<Role>('member')

const linkToken = ref<string | null>(null)
const linkLoading = ref(false)
const linkError = ref<string | null>(null)

const wsId = computed(() => props.workspaceId)
const { create } = useInvitationsApi(wsId)
const toast = useToast()

const emailInputRef = ref<HTMLInputElement | null>(null)

const validCount = computed(() => emails.value.filter(e => e.valid).length)
const linkUrl = computed(() =>
  linkToken.value ? `${window.location.origin}${pageRoutes.invite(linkToken.value)}` : '',
)

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

function commitDraft() {
  const parts = draft.value.split(/[,\s;]+/).map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return
  emails.value.push(...parts.map(p => ({ value: p, valid: isValidEmail(p) })))
  draft.value = ''
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
    e.preventDefault()
    commitDraft()
  }
  if (e.key === 'Backspace' && draft.value === '' && emails.value.length > 0) {
    emails.value.pop()
  }
}

function removeChip(i: number) {
  emails.value.splice(i, 1)
}

function switchMode() {
  mode.value = mode.value === 'emails' ? 'link' : 'emails'
  linkToken.value = null
  linkError.value = null
}

async function generateLink() {
  linkLoading.value = true
  linkError.value = null
  try {
    const res = await create.mutateAsync({ role: role.value, email: undefined })
    linkToken.value = res.token
  }
  catch (err) {
    linkError.value = getErrorMessage(err, 'Не удалось создать ссылку')
  }
  finally {
    linkLoading.value = false
  }
}

async function copyLink() {
  if (!linkUrl.value) return
  try {
    await navigator.clipboard.writeText(linkUrl.value)
    toast.add({
      title: 'Ссылка скопирована',
      color: 'success',
      icon: 'i-lucide-check',
      duration: 2500,
    })
  }
  catch {
    toast.add({
      title: 'Не удалось скопировать. Скопируйте вручную.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
      duration: 4000,
    })
  }
}

async function sendInvitations() {
  commitDraft()
  const valid = emails.value.filter(e => e.valid)
  if (valid.length === 0) return

  let success = 0
  let failed = 0
  for (const e of valid) {
    try {
      await create.mutateAsync({ role: role.value, email: e.value })
      success += 1
    }
    catch {
      failed += 1
    }
  }

  if (success > 0) {
    toast.add({
      title: `Отправлено ${success} ${pluralRu(success, 'приглашение', 'приглашения', 'приглашений')}`,
      description: failed > 0 ? `Не удалось отправить: ${failed}` : undefined,
      color: failed > 0 ? 'warning' : 'success',
      icon: 'i-lucide-check',
      duration: 5000,
    })
  }
  else {
    toast.add({
      title: 'Не удалось отправить приглашения',
      color: 'error',
      icon: 'i-lucide-alert-circle',
      duration: 5000,
    })
  }

  if (success > 0) open.value = false
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

function reset() {
  mode.value = 'emails'
  emails.value = []
  draft.value = ''
  role.value = 'member'
  linkToken.value = null
  linkError.value = null
}

watch(open, (v) => {
  if (!v) reset()
})
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'max-w-xl' }"
  >
    <template #content>
      <div class="flex items-center gap-3 p-5 border-b border-default">
        <span class="inline-flex size-9 items-center justify-center rounded-lg bg-primary shrink-0">
          <UIcon name="i-lucide-mail-plus" class="size-4 text-accent-500" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold text-default tracking-tight">
            Пригласить в workspace
          </h3>
          <p class="text-xs text-muted mt-0.5">
            В <span class="text-default font-medium">{{ workspaceName }}</span> · приглашения активны 7 дней
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          size="sm"
          color="neutral"
          variant="soft"
          @click="open = false"
        />
      </div>

      <div class="p-5 space-y-4 overflow-y-auto">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-default uppercase tracking-wide">
              {{ mode === 'emails' ? 'Email-адреса' : 'Ссылка-приглашение' }}
              <span v-if="mode === 'emails'" class="text-accent-500 ml-0.5">*</span>
            </span>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs text-muted hover:text-accent-600 transition-colors"
              @click="switchMode"
            >
              <UIcon :name="mode === 'emails' ? 'i-lucide-link' : 'i-lucide-mail'" class="size-3" />
              {{ mode === 'emails' ? 'Получить ссылку без email' : 'Пригласить по email' }}
            </button>
          </div>

          <template v-if="mode === 'emails'">
            <div
              class="flex flex-wrap items-center gap-1.5 min-h-[44px] px-2.5 py-2 rounded-lg border border-default bg-default cursor-text focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-100 transition"
              @click="emailInputRef?.focus()"
            >
              <span
                v-for="(e, i) in emails"
                :key="i"
                class="inline-flex items-center gap-1.5 h-6 pl-2.5 pr-1 rounded-full text-xs font-mono"
                :class="e.valid ? 'bg-elevated text-default' : 'bg-error-50 text-error-600'"
                :title="e.valid ? '' : 'Невалидный email'"
              >
                {{ e.value }}
                <button
                  type="button"
                  class="inline-flex size-4 items-center justify-center rounded-full hover:bg-default/50 transition-colors"
                  @click.stop="removeChip(i)"
                >
                  <UIcon name="i-lucide-x" class="size-3" />
                </button>
              </span>
              <input
                ref="emailInputRef"
                v-model="draft"
                type="text"
                :placeholder="emails.length === 0 ? 'colleague@company.com, через запятую…' : ''"
                class="flex-1 min-w-[140px] h-6 text-sm bg-transparent border-none outline-none text-default placeholder:text-dimmed"
                @keydown="onKeyDown"
                @blur="commitDraft"
              >
            </div>
            <p class="text-[11.5px] text-muted mt-1.5 leading-snug">
              Введите один или несколько адресов через запятую, пробел или Enter.
              Каждому будет отправлено отдельное письмо.
            </p>
          </template>

          <template v-else>
            <div
              v-if="!linkToken"
              class="flex items-center gap-3 p-3 rounded-lg border border-dashed border-default bg-elevated/40"
            >
              <span class="inline-flex size-7 items-center justify-center rounded-md bg-default text-default shrink-0">
                <UIcon name="i-lucide-link" class="size-3.5" />
              </span>
              <p class="flex-1 text-xs text-default leading-relaxed">
                Будет создана открытая ссылка с ролью
                <span class="font-semibold">{{ ROLE_LABEL[role] }}</span>.
                Любой, у кого есть ссылка, сможет вступить.
              </p>
              <UButton
                size="xs"
                :loading="linkLoading"
                @click="generateLink"
              >
                Создать
              </UButton>
            </div>
            <div
              v-else
              class="flex items-center gap-3 p-3 rounded-lg border border-default bg-elevated/40"
            >
              <span class="inline-flex size-7 items-center justify-center rounded-md bg-success-50 text-success-600 shrink-0">
                <UIcon name="i-lucide-check" class="size-4" />
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-default mb-1">
                  Открытая ссылка для роли <span class="font-semibold">{{ ROLE_LABEL[role] }}</span>:
                </p>
                <code class="block text-[11px] font-mono text-muted bg-default border border-default rounded px-1.5 py-0.5 truncate">
                  {{ linkUrl }}
                </code>
              </div>
              <UButton size="xs" icon="i-lucide-copy" @click="copyLink">
                Копировать
              </UButton>
            </div>
            <p v-if="linkError" class="text-xs text-error-600 mt-2">{{ linkError }}</p>
          </template>
        </div>

        <div>
          <p class="text-xs font-semibold text-default uppercase tracking-wide mb-2">
            Роль <span class="text-accent-500">*</span>
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="opt in ROLE_OPTIONS"
              :key="opt.value"
              type="button"
              class="flex items-start gap-2.5 p-3 rounded-lg border-[1.5px] text-left transition-colors"
              :class="role === opt.value
                ? 'border-accent-500 bg-accent-50/60'
                : 'border-default bg-default hover:border-neutral-300'"
              @click="role = opt.value"
            >
              <span
                class="inline-flex size-4 items-center justify-center rounded-full border-2 mt-0.5 shrink-0 transition-colors"
                :class="role === opt.value ? 'border-accent-500' : 'border-neutral-400'"
              >
                <span
                  v-if="role === opt.value"
                  class="size-2 rounded-full bg-accent-500"
                />
              </span>
              <span class="flex-1 min-w-0">
                <span class="flex items-center gap-1.5 text-sm font-semibold text-default mb-0.5">
                  <span class="size-1.5 rounded-full" :class="ROLE_DOT_CLASS[opt.value]" />
                  {{ ROLE_LABEL[opt.value] }}
                </span>
                <span class="block text-[11.5px] text-muted leading-snug">
                  {{ ROLE_DESCRIPTION[opt.value] }}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 p-4 border-t border-default">
        <p class="flex-1 text-xs text-muted">
          <template v-if="mode === 'emails'">
            <span v-if="validCount === 0">Введите хотя бы один email-адрес</span>
            <span v-else>
              Будет отправлено
              <span class="text-default font-semibold">{{ validCount }}</span>
              {{ pluralRu(validCount, 'приглашение', 'приглашения', 'приглашений') }}
              с ролью
              <span class="text-default font-semibold">{{ ROLE_LABEL[role] }}</span>
            </span>
          </template>
          <template v-else>
            Ссылка с ролью <span class="text-default font-semibold">{{ ROLE_LABEL[role] }}</span> · 7 дней
          </template>
        </p>
        <UButton variant="soft" color="neutral" @click="open = false">
          Отмена
        </UButton>
        <UButton
          v-if="mode === 'emails'"
          icon="i-lucide-send"
          :disabled="validCount === 0"
          :loading="create.isPending.value"
          @click="sendInvitations"
        >
          Пригласить{{ validCount > 0 ? ` (${validCount})` : '' }}
        </UButton>
        <UButton
          v-else-if="linkToken"
          icon="i-lucide-copy"
          @click="copyLink"
        >
          Копировать ссылку
        </UButton>
      </div>
    </template>
  </UModal>
</template>
