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
  <section id="cta" class="section cta">
    <div class="cta__glow" />
    <div class="wrap">
      <div class="cta__box reveal">
        <div class="section__tag center"><span class="n">07</span> — Ранний доступ</div>
        <h2>Зайдите, потестируйте, <span class="o">предложите идею</span></h2>
        <p>Оставьте почту — пришлю приглашение в воркспейс и спрошу, что вам важнее.</p>

        <div v-if="sent" class="cta__form">
          <div class="cta__done">Спасибо! <span class="o">Приглашение уже летит</span> на {{ email || 'вашу почту' }}.</div>
        </div>
        <div v-else class="cta__form">
          <div class="cta__row">
            <div class="field"><input v-model="email" type="email" placeholder="email@команда.рф"></div>
            <div class="field"><input v-model="team" type="text" placeholder="Команда / роль (необязательно)"></div>
          </div>
          <input
            v-model="company" type="text" tabindex="-1" autocomplete="off" aria-hidden="true"
            style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;"
          >
          <div class="cta__checks">
            <button
              v-for="[k, label] in checks" :key="k"
              type="button" class="check" :class="{ on: intents[k] }" @click="toggle(k)"
            >
              <span class="box">
                <svg v-if="intents[k]" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 3 3 7-7" /></svg>
              </span>
              {{ label }}
            </button>
          </div>
          <label class="cta__agree" :class="{ on: consent }">
            <input v-model="consent" type="checkbox" class="cta__agree-input">
            <span class="box">
              <svg v-if="consent" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 3 3 7-7" /></svg>
            </span>
            <span class="cta__agree-text">
              Даю согласие на обработку моих персональных данных и принимаю условия
              <NuxtLink to="/privacy" target="_blank" rel="noopener" @click.stop>Политики обработки данных</NuxtLink>.
            </span>
          </label>
          <div class="cta__submit">
            <button class="btn btn--primary btn--static" :disabled="!email.trim() || !consent || loading" @click="submit">
              {{ loading ? 'Отправляем…' : 'Получить ранний доступ' }}
              <svg class="arr" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 12 4M6 4h6v6" /></svg>
            </button>
            <span v-if="error" class="agree" style="color:#e0532f;">{{ error }}</span>
            <span v-else class="agree">Без спама. Только приглашение и важные апдейты беты.</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>