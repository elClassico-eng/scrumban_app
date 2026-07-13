<script setup lang="ts">
type IntentKey = 'try' | 'partner' | 'follow'

const email = ref('')
const team = ref('')
const intents = reactive<Record<IntentKey, boolean>>({ try: true, partner: false, follow: false })
const company = ref('')
const consent = ref(false)
const sent = ref(false)
const loading = ref(false)
const error = ref('')

const checks: Array<[IntentKey, string]> = [
  ['try', 'Хочу попробовать'],
  ['partner', 'Обсудить сотрудничество'],
  ['follow', 'Просто следить'],
]

function toggle(k: IntentKey) {
  intents[k] = !intents[k]
}

async function submit() {
  if (!email.value.trim() || !consent.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const selected = (Object.keys(intents) as IntentKey[]).filter(k => intents[k])
    await $fetch('/api/leads', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        team: team.value.trim() || undefined,
        intents: selected,
        company: company.value,
        consent: consent.value,
      },
    })
    sent.value = true
  }
  catch {
    error.value = 'Не удалось отправить. Попробуйте ещё раз или напишите в Telegram.'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <section id="cta" class="section cta2">
    <div class="wrap">
      <div class="cta2__card reveal">
        <div class="cone cone--cta" aria-hidden="true">
          <i class="cone__l cone__l--1" /><i class="cone__l cone__l--2" /><i class="cone__l cone__l--3" />
        </div>
        <div class="cta2__content">
        <p class="eyebrow">Ранний доступ</p>
        <h2>Зайдите, потестируйте,<br>предложите идею</h2>
        <p class="cta2__lead">Оставьте почту – пришлю приглашение в воркспейс и спрошу, что вам важнее.</p>

        <div v-if="sent" class="cta2__form">
          <div class="cta2__done">Спасибо! Приглашение уже летит на {{ email || 'вашу почту' }}.</div>
        </div>
        <div v-else class="cta2__form">
          <div class="cta2__row">
            <input v-model="email" type="email" placeholder="email@команда.рф">
            <input v-model="team" type="text" placeholder="Команда / роль (необязательно)">
          </div>
          <input
            v-model="company" type="text" tabindex="-1" autocomplete="off" aria-hidden="true"
            style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;"
          >
          <div class="cta2__checks">
            <button
              v-for="[k, label] in checks" :key="k"
              type="button" class="check2" :class="{ on: intents[k] }" @click="toggle(k)"
            >
              {{ label }}
            </button>
          </div>
          <label class="cta2__agree" :class="{ on: consent }">
            <input v-model="consent" type="checkbox" class="cta2__agree-input">
            <span class="box">
              <svg v-if="consent" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 3 3 7-7" /></svg>
            </span>
            <span class="cta2__agree-text">
              Даю согласие на обработку моих персональных данных и принимаю условия
              <NuxtLink to="/privacy" target="_blank" rel="noopener" @click.stop>Политики обработки данных</NuxtLink>.
            </span>
          </label>
          <div class="cta2__submit">
            <button class="btn btn--dark" :disabled="!email.trim() || !consent || loading" @click="submit">
              {{ loading ? 'Отправляем…' : 'Получить ранний доступ' }}
            </button>
            <span v-if="error" class="cta2__note cta2__note--err">{{ error }}</span>
            <span v-else class="cta2__note">Без спама. Только приглашение и важные апдейты беты.</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  </section>
</template>