<script setup lang="ts">
const props = defineProps<{ workspaceId: string }>()

const STEPS = ['Создай бота', 'Вставь токен', 'Готово']
const { connect } = usePachcaApi(computed(() => props.workspaceId))
const toast = useToast()
const step = ref(0)
const token = ref('')

async function submit() {
  try {
    await connect.mutateAsync({ token: token.value.trim() })
    token.value = ''
    toast.add({ title: 'Пачка подключена', color: 'success', icon: 'i-hugeicons-checkmark-circle-02' })
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось подключить Пачку'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
}
</script>

<template>
  <SettingsTile>
    <ol class="mb-6 flex items-center gap-2">
      <li v-for="(label, i) in STEPS" :key="label" class="flex flex-1 items-center gap-2">
        <span
          class="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
          :class="i < step ? 'bg-success text-white' : i === step ? 'bg-accent-500 text-white' : 'bg-accented text-muted'"
        >
          <UIcon v-if="i < step" name="i-hugeicons-tick-02" class="size-4" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="hidden text-sm sm:inline" :class="i === step ? 'font-medium text-default' : 'text-muted'">{{ label }}</span>
        <span v-if="i < STEPS.length - 1" class="h-px flex-1 bg-accented" />
      </li>
    </ol>

    <div v-if="step === 0" class="space-y-4">
      <p class="font-semibold text-default">Создай бота в Пачке</p>
      <ol class="list-decimal space-y-2 pl-5 text-sm text-toned">
        <li>В Пачке открой «Автоматизации» → «Интеграции» → «Чат-боты» и создай бота, например «Такт».</li>
        <li>На вкладке «API» включи права: <code class="text-xs">messages:create</code>, <code class="text-xs">users:read</code>, <code class="text-xs">chats:read</code>, а для карточек ссылок ещё <code class="text-xs">link_previews:write</code>.</li>
        <li>Скопируй токен бота – он понадобится на следующем шаге.</li>
      </ol>
      <div class="flex justify-end">
        <UButton trailing-icon="i-hugeicons-arrow-right-01" @click="step = 1">Токен у меня</UButton>
      </div>
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <p class="font-semibold text-default">Вставь токен бота</p>
      <p class="text-sm text-muted">Токен хранится зашифрованным и больше нигде не показывается. Проверим его прямо в Пачке.</p>
      <UInput v-model="token" type="password" placeholder="Токен бота" class="w-full" autofocus />
      <div class="flex justify-between gap-2">
        <UButton variant="ghost" color="neutral" icon="i-hugeicons-arrow-left-01" @click="step = 0">Назад</UButton>
        <UButton type="submit" :disabled="!token.trim()" :loading="connect.isPending.value">Подключить</UButton>
      </div>
    </form>
  </SettingsTile>
</template>
