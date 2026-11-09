<script setup lang="ts">
const props = defineProps<{ workspace: { id: string, name: string } | null }>()
const emit = defineEmits<{ done: [] }>()
const open = defineModel<boolean>('open', { default: false })

const wsId = computed(() => props.workspace?.id ?? '')
const { me } = useProfileApi()
const { list, updateRole } = useMembersApi(wsId)
const toast = useToast()
const heirId = ref<string | undefined>()

const candidates = computed(() => (list.data.value?.members ?? [])
  .filter(m => m.userId !== me.data.value?.user.id && m.role !== 'owner')
  .map(m => ({ label: `${displayName(m)} · ${m.email}`, value: m.userId })))

watch(open, (v) => {
  if (v) heirId.value = undefined
})

async function transfer() {
  if (!heirId.value) return
  try {
    await updateRole.mutateAsync({ userId: heirId.value, role: 'owner' })
    toast.add({ title: 'Теперь у воркспейса два владельца', color: 'success', icon: 'i-hugeicons-checkmark-circle-02' })
    open.value = false
    emit('done')
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось передать владение'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="`Передать «${workspace?.name ?? ''}»`" description="Выбранный участник станет владельцем. Твоя роль не изменится, пока ты не удалишь аккаунт.">
    <template #body>
      <USelectMenu
        v-if="candidates.length"
        v-model="heirId"
        :items="candidates"
        value-key="value"
        placeholder="Кому передать"
        class="w-full"
      />
      <p v-else class="text-sm text-muted">
        В воркспейсе нет других участников. Пригласи кого-нибудь или удали воркспейс.
      </p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="open = false">Отмена</UButton>
        <UButton :disabled="!heirId" :loading="updateRole.isPending.value" @click="transfer">Передать</UButton>
      </div>
    </template>
  </UModal>
</template>
