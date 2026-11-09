<script setup lang="ts">
const { start, startLabel } = useAccessCta()
</script>

<template>
  <section class="final" data-cta-end>
    <div class="wrap reveal">
      <h2>Задайте команде ритм</h2>
      <p class="muted">Регистрация за минуту. Бесплатно, без карты.</p>
      <button type="button" class="btn btn--dark btn--lg" @click="start">{{ startLabel }}</button>
    </div>
  </section>
</template>

<style scoped>
.final { padding: 120px 0 80px; text-align: center; }
.final h2 { margin: 0 auto; max-width: 16ch; font-size: clamp(40px, 5vw, 56px); }
.final p { margin-top: 16px; font-size: 17px; }
.final .btn { margin-top: 30px; }
</style>
