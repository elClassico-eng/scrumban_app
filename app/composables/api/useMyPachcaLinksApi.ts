import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type { MyPachcaLink } from '#shared/types/integrations'
import type { InstantNotificationType } from '#shared/types/notification'

type LinksResponse = { links: MyPachcaLink[] }

export function useMyPachcaLinksApi() {
  const qc = useQueryClient()
  const links = useQuery({
    queryKey: ['users', 'me', 'pachca'],
    queryFn: () => $fetch<LinksResponse>(apiRoutes.usersMePachca),
  })
  const update = useMutation({
    mutationFn: (body: { instantTypes?: InstantNotificationType[], digest?: boolean }) =>
      $fetch<LinksResponse>(apiRoutes.usersMePachca, { method: 'PATCH', body }),
    onSuccess: data => qc.setQueryData(['users', 'me', 'pachca'], data),
  })
  return { links, update }
}
