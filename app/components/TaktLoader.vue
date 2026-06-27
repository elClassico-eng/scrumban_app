<script setup lang="ts">
defineProps<{ label?: string }>()
</script>

<template>
  <div class="takt-loader">
    <div class="takt-loader__inner">
      <TaktMark animated class="takt-loader__mark" />
      <div class="takt-loader__word">Такт</div>
      <div v-if="label" class="takt-loader__label">{{ label }}</div>
    </div>
  </div>
</template>

<style scoped>
.takt-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: #090909;
  color: #f4f1ea;
}
.takt-loader__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.takt-loader__mark {
  width: 76px;
  height: 76px;
}
.takt-loader__word {
  font-family: 'Unbounded', system-ui, sans-serif;
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.02em;
}
.takt-loader__label {
  font-size: 13px;
  color: rgba(244, 241, 234, 0.6);
}
</style>
