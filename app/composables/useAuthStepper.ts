type AuthStepper = {
  step: { readonly value: number }
  total: number
  next: () => void
  prev: () => void
}

const current = shallowRef<AuthStepper | null>(null)

export function provideAuthStepper(stepper: AuthStepper) {
  current.value = stepper
  onUnmounted(() => {
    if (current.value === stepper) current.value = null
  })
}

export function useAuthStepper() {
  return current
}
