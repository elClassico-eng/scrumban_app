<script setup lang="ts">
import '~/assets/css/landing.css'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: false })
useHead({ title: 'Обратная связь – Такт' })
useSeoMeta({ description: 'Расскажите, что нравится в Такте, что мешает и чего не хватает.' })

const form = reactive({
  liked: '',
  disliked: '',
  missing: '',
  rating: null as number | null,
  email: '',
  team: '',
  wantsReply: false,
  consent: false,
  company: '',
})

const { sessionQuery } = useAuthApi()
onMounted(async () => {
  if (sessionQuery.isLoading.value) await sessionQuery.suspense()
  const email = sessionQuery.data.value?.user?.email
  if (email && !form.email) form.email = email
})

const hasText = computed(() => !!(form.liked.trim() || form.disliked.trim() || form.missing.trim()))
const needsConsent = computed(() => !!(form.email.trim() || form.team.trim()))
const canSend = computed(() =>
  hasText.value
  && (!form.wantsReply || !!form.email.trim())
  && (!needsConsent.value || form.consent),
)

const sending = ref(false)
const sent = ref(false)
const error = ref('')

async function submit() {
  if (!canSend.value || sending.value) return
  sending.value = true
  error.value = ''
  try {
    await $fetch(apiRoutes.feedback, {
      method: 'POST',
      body: {
        liked: form.liked,
        disliked: form.disliked,
        missing: form.missing,
        rating: form.rating ?? undefined,
        email: form.email.trim() || undefined,
        team: form.team.trim() || undefined,
        wantsReply: form.wantsReply,
        consent: needsConsent.value ? true : undefined,
        company: form.company,
      },
    })
    sent.value = true
  }
  catch (err) {
    error.value = getErrorMessage(err, 'Не удалось отправить отзыв. Попробуйте ещё раз')
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="landing">
    <LandingHeader />
    <main class="fb">
      <div class="wrap fb__wrap">
        <aside class="fb__intro">
          <p class="fb__tag">Обратная связь</p>
          <h1>Расскажите, как вам Такт</h1>
          <p class="fb__lead muted">
            Я читаю каждый отзыв. Хватит и одного поля – а если нужен ответ, оставьте почту.
          </p>
          <div class="fb__beta">
            <b>Такт в бете</b>
            <p>Возможны неточности: продукт постоянно дорабатывается. Если что-то сломалось или считает странно, опишите, что вы делали и что увидели, – так я быстрее найду причину.</p>
          </div>
        </aside>

        <div v-if="sent" class="card card--warm fb__done">
          <h2>Спасибо! Прочитаю каждый отзыв</h2>
          <p class="muted">Если вы просили ответ, напишу на указанную почту.</p>
          <a class="btn btn--dark" href="/">На главную</a>
        </div>

        <form v-else class="card fb__form" @submit.prevent="submit">
          <label class="fb__field">
            <span>Что нравится</span>
            <textarea v-model="form.liked" rows="5" maxlength="5000" />
          </label>
          <label class="fb__field">
            <span>Что мешает</span>
            <textarea v-model="form.disliked" rows="5" maxlength="5000" />
          </label>
          <label class="fb__field">
            <span>Чего не хватает</span>
            <textarea v-model="form.missing" rows="5" maxlength="5000" />
          </label>

          <fieldset class="fb__rating">
            <legend>Насколько Такт полезен вашей команде? <i class="muted">необязательно</i></legend>
            <div>
              <button
                v-for="n in 5"
                :key="n"
                type="button"
                :class="{ on: form.rating === n }"
                :aria-pressed="form.rating === n"
                @click="form.rating = form.rating === n ? null : n"
              >
                {{ n }}
              </button>
            </div>
            <p class="muted">1 – совсем не полезен, 5 – очень полезен</p>
          </fieldset>

          <div class="fb__row">
            <label class="fb__field">
              <span>Email <i class="muted">необязательно</i></span>
              <input v-model="form.email" type="email" autocomplete="email" maxlength="255">
            </label>
            <label class="fb__field">
              <span>Команда <i class="muted">необязательно</i></span>
              <input v-model="form.team" type="text" maxlength="200">
            </label>
          </div>

          <label class="fb__check">
            <input v-model="form.wantsReply" type="checkbox">
            <span>Хочу получить ответ</span>
          </label>
          <label v-if="needsConsent" class="fb__check">
            <input v-model="form.consent" type="checkbox" required>
            <span>
              Даю <a :href="pageRoutes.consent" target="_blank" rel="noopener">согласие на обработку персональных данных</a>
            </span>
          </label>

          <input v-model="form.company" class="fb__trap" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">

          <div class="fb__submit">
            <button type="submit" class="btn btn--dark btn--lg" :disabled="!canSend || sending">
              {{ sending ? 'Отправляю…' : 'Отправить отзыв' }}
            </button>
            <p v-if="error" class="fb__error">{{ error }}</p>
            <p v-else-if="form.wantsReply && !form.email.trim()" class="muted">Укажите email, чтобы я мог ответить</p>
          </div>
        </form>
      </div>
    </main>
    <LandingFooter />
  </div>
</template>

<style scoped>
.fb { padding: 56px 0 24px; }
.fb__wrap { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 56px; align-items: start; }
.fb__intro { position: sticky; top: 120px; }
.fb__tag { font: 11px var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--orange); }
.fb h1 { font-size: clamp(32px, 5vw, 56px); line-height: 1.05; margin-top: 14px; }
.fb__lead { margin-top: 16px; font-size: 18px; }
.fb__beta { margin-top: 28px; padding: 18px 20px; border-radius: 18px; background: var(--orange-soft); font-size: 14.5px; }
.fb__beta b { display: block; margin-bottom: 4px; font-weight: 500; color: var(--orange); }
.fb__beta p { color: var(--ink-2); }
.fb__form { display: grid; gap: 18px; }
.fb__field { display: grid; gap: 8px; font-size: 14px; font-weight: 500; }
.fb__field i, .fb__rating i { font-style: normal; font-weight: 400; font-size: 12.5px; margin-left: 6px; }
.fb__field :is(input, textarea) {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 13px 14px;
  font: 15px/1.5 var(--font-body);
  color: var(--ink);
  background: #fff;
}
/* Fixed size instead of a resize handle; grows with the text where supported. */
.fb__field textarea { resize: none; min-height: 140px; max-height: 360px; field-sizing: content; }
.fb__field :is(input, textarea):focus { outline: 2px solid var(--orange); outline-offset: 0; }
.fb__rating { border: 0; padding: 0; margin: 0; display: grid; gap: 10px; font-size: 14px; font-weight: 500; }
.fb__rating div { display: flex; gap: 8px; }
.fb__rating button {
  width: 48px; height: 48px;
  border: 0; border-radius: 14px;
  background: #fff; color: var(--ink);
  font: 500 16px var(--font-display);
  cursor: pointer;
}
.fb__rating button.on { background: var(--ink); color: #fff; }
.fb__rating p { font-size: 12.5px; font-weight: 400; }
.fb__row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.fb__check { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; }
.fb__check input { width: 18px; height: 18px; margin-top: 1px; accent-color: var(--ink); }
.fb__check a { color: var(--orange); text-decoration: underline; text-underline-offset: 3px; }
.fb__trap { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.fb__submit { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 13.5px; }
.fb__error { color: #c43f00; }
.fb__done { display: grid; gap: 12px; justify-items: start; }
.fb__done h2 { font-size: 26px; }

@media (max-width: 900px) {
  .fb__wrap { grid-template-columns: 1fr; gap: 32px; }
  .fb__intro { position: static; }
}
@media (max-width: 640px) {
  .fb__row { grid-template-columns: 1fr; }
}
</style>
