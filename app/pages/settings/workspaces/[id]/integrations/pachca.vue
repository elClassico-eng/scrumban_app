<script setup lang="ts">
const { current } = useSettingsWorkspace()
</script>

<template>
  <SettingsIntegrationsPanel v-if="current" />
</template>
