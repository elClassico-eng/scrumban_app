<script setup lang="ts">
withDefaults(defineProps<{ label?: string, phrases?: string[] }>(), { label: undefined, phrases: () => [] })
</script>

<template>
  <div class="takt-loader">
    <div class="takt-loader__inner">
      <div class="takt-loader__brand">
        <TaktMark animated class="takt-loader__mark" />
        <span class="takt-loader__word">Такт</span>
      </div>
      <div v-if="label" class="takt-loader__label">{{ label }}</div>
      <div v-else-if="phrases.length" class="takt-loader__phrases" :style="{ '--n': phrases.length }">
        <span v-for="(p, i) in phrases" :key="p" class="takt-loader__phrase" :style="{ '--i': i }">{{ p }}</span>
      </div>
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
  font-family: 'Unbounded', system-ui, sans-serif;
}
.takt-loader__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  width: 100%;
  padding: 0 24px;
  animation: takt-loader-in 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.takt-loader__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.takt-loader__mark {
  width: 44px;
  height: 44px;
}
.takt-loader__word {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.02em;
  opacity: 0.85;
}
.takt-loader__label {
  font-size: 14px;
  color: rgba(244, 241, 234, 0.6);
}
.takt-loader__phrases {
  position: relative;
  width: 100%;
  height: 1.3em;
  font-size: clamp(26px, 4.2vw, 46px);
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1.3;
}
.takt-loader__phrase {
  position: absolute;
  inset: 0;
  text-align: center;
  white-space: nowrap;
  opacity: 0;
  animation: takt-loader-phrase calc(var(--n) * 1.8s) cubic-bezier(0.4, 0, 0.2, 1) infinite;
  animation-delay: calc(var(--i) * 1.8s);
}
@keyframes takt-loader-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes takt-loader-phrase {
  0% { opacity: 0; transform: translateY(0.5em); filter: blur(8px); }
  8%, 20% { opacity: 1; transform: translateY(0); filter: blur(0); }
  27%, 100% { opacity: 0; transform: translateY(-0.5em); filter: blur(8px); }
}
</style>
