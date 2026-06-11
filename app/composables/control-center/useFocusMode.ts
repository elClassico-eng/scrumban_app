export const useFocusMode = createSharedComposable(() => {
  const focus = useLocalStorage('scrumban:cc-focus', false)

  function toggle() {
    focus.value = !focus.value
  }

  return { focus, toggle }
})
