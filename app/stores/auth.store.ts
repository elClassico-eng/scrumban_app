import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const { sessionQuery } = useAuthApi()

  const user = computed(() => sessionQuery.data.value?.user ?? null)
  const isAuthenticated = computed(() => user.value !== null)
  const isLoading = computed(() => sessionQuery.isLoading.value)

  return { user, isAuthenticated, isLoading }
})