<script setup lang="ts">
import { pageRoutes } from '~/routing'
import { PILOT_TERMS } from '~/utils/landing-content'

const form = reactive({ email: '', teamSize: '', currentTool: '', consent: false, company: '' })
const sending = ref(false)
const sent = ref(false)
const error = ref('')

const canSend = computed(() => !!form.email.trim() && form.consent && !sending.value)

async function submit() {
  if (!canSend.value) return
  sending.value = true
  error.value = ''
  try {
    await $fetch('/api/leads', {
      method: 'POST',
      body: {
        email: form.email.trim(),
        teamSize: form.teamSize.trim() || undefined,
        currentTool: form.currentTool.trim() || undefined,
        consent: true,
        company: form.company,
      },
    })
    sent.value = true
  }
  catch (err) {
    error.value = getErrorMessage(err, 'Не удалось отправить заявку. Попробуйте ещё раз или напишите мне на почту')
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <section id="pilot" class="section">
    <div class="wrap">
      <LandingSectionHead :n="9" label="пилот" />
      <div class="pilot">
        <article class="card reveal">
          <h2 class="pilot__title">Ищу первые команды для пилота</h2>
          <ul class="pilot__terms">
            <li v-for="t in PILOT_TERMS" :key="t">{{ t }}</li>
          </ul>
        </article>
        <article class="card card--warm reveal">
          <div v-if="sent" class="pilot__done">
            <h3>Спасибо! Я напишу вам в течение пары дней</h3>
            <p class="muted">Ответ придёт на {{ form.email }}.</p>
          </div>
          <form v-else class="pilot__form" @submit.prevent="submit">
            <h3>Заявка на пилот</h3>
            <input v-model="form.email" type="email" required autocomplete="email" maxlength="255" placeholder="email@команда.рф" aria-label="Email">
            <input v-model="form.teamSize" type="text" maxlength="50" placeholder="Сколько человек в команде" aria-label="Размер команды">
            <input v-model="form.currentTool" type="text" maxlength="200" placeholder="Чем пользуетесь сейчас (Jira, Trello, таблицы…)" aria-label="Чем пользуетесь сейчас">
            <input v-model="form.company" class="pilot__trap" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
            <label class="pilot__check">
              <input v-model="form.consent" type="checkbox" required>
              <span>Даю <a :href="pageRoutes.consent" target="_blank" rel="noopener">согласие на обработку персональных данных</a></span>
            </label>
            <button type="submit" class="btn btn--dark" :disabled="!canSend">
              {{ sending ? 'Отправляю…' : 'Отправить заявку' }}
            </button>
            <p v-if="error" class="pilot__error">{{ error }}</p>
          </form>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pilot { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
.pilot__title { font-size: clamp(30px, 3.4vw, 38px); }
.pilot__terms { list-style: none; display: grid; gap: 12px; margin: 22px 0 0; padding: 0; font-size: 16px; }
.pilot__terms li::before { content: "♩ "; color: var(--orange); }
.pilot__form { display: grid; gap: 10px; }
.pilot__form h3, .pilot__done h3 { font-size: 20px; margin-bottom: 6px; }
.pilot__form input:not([type="checkbox"]) {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  font: 14px var(--font-body);
  color: var(--ink);
}
.pilot__form input:not([type="checkbox"]):focus { outline: 2px solid var(--orange); outline-offset: 0; border-color: transparent; }
.pilot__check { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--ink-2); }
.pilot__check input { width: 17px; height: 17px; margin-top: 1px; accent-color: var(--ink); }
.pilot__check a { color: var(--orange); text-decoration: underline; text-underline-offset: 3px; }
.pilot__form .btn { justify-self: start; margin-top: 4px; }
.pilot__trap { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.pilot__error { font-size: 13px; color: #c43f00; }
.pilot__done p { margin-top: 6px; }

@media (max-width: 900px) {
  .pilot { grid-template-columns: 1fr; }
}
</style>
