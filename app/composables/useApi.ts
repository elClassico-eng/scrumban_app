import { pageRoutes } from '~/routing'

export function useApi() {
  const router = useRouter()

  async function api<T>(url: string, opts?: Parameters<typeof $fetch>[1]): Promise<T> {
    try {
      return (await $fetch<T>(url, opts)) as T
    }
    catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 401) {
        await router.push(pageRoutes.login)
      }
      throw err
    }
  }

  return { api }
}