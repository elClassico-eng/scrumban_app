<script setup lang="ts">
type IntentKey = 'try' | 'partner' | 'follow'

const email = ref('')
const team = ref('')
const intents = reactive<Record<IntentKey, boolean>>({ try: true, partner: false, follow: false })
const sent = ref(false)

const checks: Array<[IntentKey, string]> = [
  ['try', 'Хочу попробовать'],
  ['partner', 'Обсудить сотрудничество'],
  ['follow', 'Просто следить'],
]

function toggle(k: IntentKey) {
  intents[k] = !intents[k]
}
function submit() {
  if (email.value.trim()) sent.value = true
}
</script>

<template>
  <section id="cta" class="section cta">
    <div class="cta__glow" />
    <div class="wrap">
      <div class="cta__box reveal">
        <div class="section__tag center"><span class="n">07</span> — Ранний доступ</div>
        <h2>Зайди, потестируй, <span class="o">предложи идею</span></h2>
        <p>Оставь почту — пришлём приглашение в воркспейс и спросим, что для тебя важнее.</p>

        <div v-if="sent" class="cta__form">
          <div class="cta__done">Спасибо! <span class="o">Приглашение уже летит</span> на {{ email || 'вашу почту' }}.</div>
        </div>
        <div v-else class="cta__form">
          <div class="cta__row">
            <div class="field"><input v-model="email" type="email" placeholder="email@команда.рф"></div>
            <div class="field"><input v-model="team" type="text" placeholder="Команда / роль (необязательно)"></div>
          </div>
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
          <div class="cta__submit">
            <button class="btn btn--primary btn--static" :disabled="!email.trim()" @click="submit">
              Получить ранний доступ
              <svg class="arr" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 12 4M6 4h6v6" /></svg>
            </button>
            <span class="agree">Без спама. Только приглашение и важные апдейты беты.</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>