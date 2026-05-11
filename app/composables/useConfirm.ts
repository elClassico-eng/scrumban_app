import type { ConfirmOptions } from '~/stores/confirm.store'

export function useConfirm() {
  const store = useConfirmStore()
  return (opts: ConfirmOptions) => store.request(opts)
}