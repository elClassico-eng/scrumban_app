import { useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { pageRoutes } from '~/routing'

export function useLeaveWorkspace(workspace: Ref<{ id: string, name: string } | null | undefined>) {
  const { remove } = useMembersApi(computed(() => workspace.value?.id ?? ''))
  const authStore = useAuthStore()
  const confirm = useConfirm()
  const router = useRouter()
  const toast = useToast()
  const qc = useQueryClient()
  const workspaceStore = useWorkspaceStore()

  async function leave() {
    const ws = workspace.value
    const me = authStore.user?.id
    if (!ws || !me) return
    const ok = await confirm({
      title: `Покинуть «${ws.name}»?`,
      description: 'Вы потеряете доступ ко всем доскам этой команды. Вернуться можно только по новому приглашению.',
      confirmLabel: 'Покинуть',
      confirmColor: 'error',
    })
    if (!ok) return
    try {
      await remove.mutateAsync(me)
      workspaceStore.setCurrent(null)
      await qc.invalidateQueries({ queryKey: ['workspaces'] })
      await router.push(pageRoutes.workspaces)
    }
    catch (err) {
      toast.add({ title: getErrorMessage(err, 'Не удалось покинуть команду'), color: 'error', icon: 'i-hugeicons-alert-circle' })
    }
  }

  return { leave, pending: remove.isPending }
}
