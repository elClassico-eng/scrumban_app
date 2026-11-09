<script setup lang="ts">
definePageMeta({
  middleware: (to) => {
    const store = useWorkspaceStore()
    return navigateTo(legacySettingsPath(to.query.tab as string | undefined, store.currentId ?? null), { replace: true })
  },
})
</script>

<template>
  <div />
</template>
