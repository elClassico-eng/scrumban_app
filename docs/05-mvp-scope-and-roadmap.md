# 05 — Scope & Roadmap

**Документ перешит 2026-05-11.** До этой даты roadmap описывал атомарную CRUD-сборку и не отражал три пилара из [`01-vision-and-goals.md`](01-vision-and-goals.md). Текущее состояние (Phase 1-4.5 завершены, MVP смержен в `main`) — функциональный Kanban+sprints, но **не Scrumban-grade** для защиты. Этот документ — пересборка плана с пилларно-ориентированным фокусом.

---

## 1. Три пилара (recap из `01-vision-and-goals.md`)

| Pillar | Что обещаем |
|---|---|
| **B — Process-aware analytics** | CFD, cycle/lead time с percentile-разметкой, throughput, bottleneck detection по распределению времени пребывания в колонках. *Inspired by process mining approaches.* Не замена ProM/Disco/Celonis — lightweight-слой внутри инструмента. |
| **B+ — Statistical forecasting & recommendations** | Monte Carlo прогноз спринта (≥1000 симуляций, P50/P85/P95 интервалы), Little's Law рекомендации по WIP с объяснением формулы, **percentile-based alerts** на застрявшие задачи. |
| **E — РФ-интеграции** | 1С, Bitrix24, Yandex Workspace, GitFlic/GitVerse, Pachca/VK Teams. Импортозамещение после ухода Jira/Trello. |

---

## 2. Что такое Scrumban (методологическая база)

Из research'а (Corey Ladas 2008, David Anderson на classes of service, ProKanban на SLE):

| Практика | Что значит | Реализована? |
|---|---|---|
| **WIP-лимиты** на каждой стадии | Cap на количество задач в колонке; задержка нового pull когда over | ⚠️ Есть, но с `force=true` bypass; нет жёсткого pull-enforcement |
| **Pull system** | Задача не «назначается» — её *вытягивает* следующий исполнитель из ready-queue по capacity | ❌ Нет: DnD куда угодно, нет explicit pull |
| **Classes of Service (Anderson)** | Expedite (критичные, jump queue) / Fixed Date (с deadline) / Standard (FIFO) / Intangible (nice-to-have) | ❌ Нет: только priority enum low/medium/high (это не CoS) |
| **Service Level Expectations (SLE)** | Вероятностное «85% задач завершаются за N дней», основано на исторических percentile cycle time | ❌ Нет: cycle time считаем, но SLE как настройку и aging-сигнал — нет |
| **Aging WIP** | Карточки начинают «стареть» визуально по мере приближения к SLE percentile boundary (50→70→85) | ❌ Нет |
| **Replenishment cadence** | Event-driven planning: backlog пополняется когда уходит ниже order-point, не по фиксированному расписанию | ❌ Нет: только sprint-based planning, без отдельной replenishment-практики |
| **Workflow stages with sub-stages** | Колонка может иметь sub-columns (specify/execute и т.п.) | ❌ Нет: плоские колонки |
| **Swimlanes** | Горизонтальные дорожки на доске для разделения по team/assignee/customer | ❌ Нет |
| **Blocked items с reason** | Карточка может быть отмечена blocked с причиной, отдельная аналитика block-time | ❌ Нет |

**Вывод:** на сегодня мы реализовали Scrum-часть (sprints, state machine, members) + Kanban-визуализацию (доска, колонки, WIP-индикатор) + базовую аналитику (CFD, cycle/throughput/MC/Little's Law). **Из 9 Scrumban-specific практик не реализована ни одна.** Имя «Scrumban platform» в текущем виде overclaim.

---

## 3. Что есть у конкурентов (gap-анализ)

См. [`03-competitive-analysis.md`](03-competitive-analysis.md) для полного. Здесь — gap по конкретным фичам против **Kaiten** (наш ближайший прямой конкурент).

| Фича | Kaiten | У нас |
|---|---|---|
| Sub-columns / sub-stages | ✅ | ❌ |
| Swimlanes (per team/assignee/customer) | ✅ | ❌ |
| Blocking system + reason + block-time analytics | ✅ | ❌ |
| Stale card alerts (≈ aging WIP) | ✅ | ❌ |
| Sub-tasks (parent-child) | ✅ | ❌ |
| Dependencies (blocked-by/blocks) | ✅ | ❌ |
| Custom fields per task | ✅ | ❌ |
| Time tracking | ✅ | ❌ |
| Comments + threaded discussions | ✅ | ❌ |
| Attachments | ✅ | ❌ |
| In-app + email notifications | ✅ | ⚠️ только toast в текущей вкладке |
| Mobile app | ✅ | ❌ |
| Automations / workflow rules | ✅ | ❌ |
| Gantt / Timeline / Calendar views | ✅ | ❌ (только Kanban) |
| Multi-project portfolio | ✅ | ❌ |
| Cumulative Flow Diagram | ✅ | ✅ |
| Cycle time analytics + spectrum diagrams | ✅ | ✅ (без spectrum) |
| **Monte Carlo forecasting** | ❌ | ✅ — **наш differentiator** |
| **Little's Law recommendations** | ❌ | ✅ — **наш differentiator** |
| **Percentile-based stuck alerts** | ❌ | ❌ — обещано, не сделано |
| **Process mining-style analytics** | ❌ | ⚠️ event log есть, аналитики над ним — нет |
| Self-hostable / multi-tenant с RLS | ⚠️ SaaS+OP | ✅ — наш differentiator |

**Картина:** в ширине Kaiten за нами уходит **сильно** (10+ важных фич отсутствуют). В глубине аналитики мы реализовали 2 differentiator'а из 4 обещанных. **Чтобы стать thesis-defendable надо: (а) добить B+ pillar (percentile alerts), (б) реально начать Scrumban-practices (T1), (в) хотя бы 2 RF-интеграции из E.**

---

## 4. Что готово (Phase 1-4.5)

✅ **Phase 1** — auth + workspaces + members + RBAC (5 ролей) + RLS на tenant-таблицах
✅ **Phase 2** — boards + columns + tasks + task_events + SSE realtime
✅ **Phase 3** — sprints state machine + sprint_tasks + аналитика (CFD, cycle time, throughput, Monte Carlo, Little's Law)
✅ **Phase 4** — full Nuxt SPA от auth до analytics
✅ **Phase 4.5** — UX polish: ConfirmDialog, password confirm, SSE toasts, column delete UI, board/workspace rename, assignee picker, audit timeline с actor, seedDefaults

**Метрики:** 45 backend endpoint'ов; 126 тестов зелёные; RLS на 6 таблицах; full RBAC; multi-tenancy; live SSE.

**Какие pillars это закрыло:**
- B: ~60% (CFD ✓, cycle time scatter ✓, throughput ✓; bottleneck detection ❌, percentile разметка scatter ⚠️ есть базовая, variant analysis ❌)
- B+: ~50% (Monte Carlo ✓, Little's Law ✓; percentile-based alerts ❌, calibration framework ❌)
- E: ~0% (0 интеграций реализовано)

---

## 5. Что осталось — Phase plan

Каждая Phase имеет §1 **Vision pillars advanced** — обязательная сверка scope против pillars. Если §1 пустой — phase scoped wrong, надо пере-планировать. Это процессный guard rail после Phase 4.5 ошибки.

### Phase 5 — Scrumban-distinct features (T1) *— следующее*

**§1 Vision pillars advanced:** Закрывает «Scrumban-grade» имя. Без этой фазы продукт честно не Scrumban, а Kanban+sprints. Pillar B (анализ блокировок и aging), частично B+ (SLE как probabilistic statement).

**§2 Что делаем:**
1. **Classes of Service** (4 значения enum + UI + аналитика per-class)
   - Schema: `tasks.service_class enum('expedite','fixed_date','standard','intangible')`, default `standard`. Expedite has `expedite_at` timestamp, fixed_date has `due_date` timestamp.
   - UI: badge на карточке (red для expedite, calendar для fixed_date), filter по CoS, отдельная WIP-капасити для expedite (типично 1-3 задачи).
   - Backend: expedite bypass'ит column WIP limit (это правило Anderson).
2. **Service Level Expectations (SLE)** per-board
   - Schema: `boards.sle_days int`, `boards.sle_probability decimal(3,2)` (default 0.85)
   - Backend: вычисляется автоматически из исторических cycle time на board'е, поддаётся ручной настройке admin'ом.
   - UI: настройка SLE на странице board settings; «Прогноз: 85% задач завершаются за 8 дней (по 90-дневной истории)».
3. **Aging WIP** визуально
   - Frontend: цвет/контур карточки меняется по мере приближения task age к SLE percentile boundary (50% — yellow tint, 70% — orange, 85%+ — red border + warning icon).
   - Расчёт: age = `now - task entered current column at`; берётся max(percentiles from cycle time history).
4. **Pull system enforcement**
   - Backend: убрать `force=true` bypass для column WIP. Если WIP полон → 422 «Колонка заполнена, дождись освобождения». Expedite задачи bypass'ят как часть CoS правил.
   - UI: «Pull next from backlog» button в активных колонках; backlog задачи показывают свой CoS.
5. **Replenishment cadence**
   - Schema: `boards.last_replenishment_at`, `boards.replenishment_period_days` (default 7).
   - UI: badge в header доски «Следующее replenishment: через 3 дня»; admin action «Запустить replenishment сейчас» открывает модалку для перемещения задач из общего backlog в board ready-queue.

**§3 Deliverables:**
- `tasks.service_class` enum + миграция + RLS-aware service updates
- `boards.sle_*` поля + миграция
- 2 новых endpoint'а: `POST /boards/:id/replenishment` (admin+) и обновление analytics endpoint'ов с per-CoS breakdown
- UI: CoS picker в TaskCreateModal + TaskDrawer; CoS filter на доске; aging WIP визуализация; pull button; SLE настройка
- Аналитика: cycle time scatter с CoS-цветом, throughput по CoS, отдельный «expedite throughput» график

**§4 DoD:**
- Все 4 CoS работают: expedite jumps queue, fixed_date предупреждает за N дней до deadline, standard FIFO, intangible deprioritize
- Aging WIP визуально отрабатывает на тестовых данных (создал задачу, перенёс время — должна стареть)
- Pull enforcement: попытка перенести 4-ю задачу в колонку с WIP=3 даёт 422
- Replenishment cadence trigger хотя бы вручную работает
- Browser e2e: открыть доску, увидеть aging WIP, попытаться превысить WIP-limit, увидеть отказ, переключить task на expedite — увидеть bypass

**§5 Зачем сейчас:** без T1 «Scrumban» в названии диплома overclaim. Это **главное thesis-differentiation**. ~2 недели работы.

---

### Phase 6 — Hierarchy & dependencies (T2)

**§1 Vision pillars advanced:** Это не pillar B/B+/E напрямую, но **требование «команды 30+»** из vision. Без иерархии и зависимостей продукт нерабочий для 30 человек в плоской доске.

**§2 Что делаем:**
1. **Sub-tasks** (parent-child задач): `tasks.parent_task_id uuid nullable` FK на `tasks.id`
2. **Dependencies graph**: новая таблица `task_dependencies (blocker_task_id, blocked_task_id)` + UI «blocked by» / «blocks» на карточке и в drawer
3. **Blocked status + reason**: `tasks.blocked_reason text nullable`; карточка с заполненным `blocked_reason` отображается с замочком и tooltip-причиной
4. **Swimlanes** (per assignee / per CoS / per epic): UI-toggle на доске, не меняет storage
5. **Epic level** (опционально, если есть время): `tasks.is_epic boolean` + соответствующий UI

**§3 Deliverables:**
- Schema + миграции
- Backend: validation что нельзя удалить task с blockers/blocked (или гарантия каскада)
- UI: deps editor в TaskDrawer (poly-select members + tasks), block reason input, swimlane toggle

**§4 DoD:** sub-tasks показываются в drawer parent'а; блокированная задача рисуется с замочком; swimlane render правильно группирует.

**§5 Зачем:** vision требует «30+ команды», без иерархии не получится. ~2 недели.

---

### Phase 7 — Collaboration & notifications (T3)

**§1 Vision pillars advanced:** Базовый функциональный фитнес. Без этого продукт нельзя реально пользоваться в команде.

**§2 Что делаем:**
1. **Comments per task**: новая таблица `task_comments (id, task_id, author_id, body markdown, created_at)`
2. **In-app notifications**: новая таблица `notifications (id, user_id, type, payload jsonb, read_at)`; полл через query (или SSE per-user channel). Triggers: assignee changed → notify new assignee; mention `@email` в комментарии → notify mentioned; blocker resolved → notify blocked-task assignee.
3. **Email digest** (daily, опционально): почасовый pg-boss job собирает unread notifications → отправляет одно письмо.
4. **Attachments** (S3/MinIO upload): `task_attachments (id, task_id, url, filename, size, uploaded_by, uploaded_at)`. Upload через signed URL.

**§3 Deliverables:**
- Comment thread UI в TaskDrawer (markdown + mentions с автокомплитом из членов workspace)
- Notification bell в header с unread badge + dropdown last 20
- Attachment uploader в drawer
- pg-boss queue setup для emails (это первая background job в проекте)
- SMTP integration (Yandex Mail / SES / Mailgun — какой настроишь)

**§4 DoD:** комментарий с упоминанием создает notification у упомянутого; assignee change создает notification; attachment загружается и скачивается; email digest отправляется (можно тестировать с MailHog локально).

**§5 Зачем:** без comments / notifications в команде 30 человек никто не узнает что задачи назначены. Базовый функциональный требование. ~1.5-2 недели.

---

### Phase 8 — Analytics depth & calibration (T4) — *thesis math*

**§1 Vision pillars advanced:** Главное — pillar **B+** (statistical forecasting). Закрываем оставшиеся 50% B+ — percentile alerts + calibration. Также pillar **B** (process-mining-style variant analysis).

**§2 Что делаем:**
1. **Percentile-based stuck-task alerts** *(обещано в vision B+, до сих пор не сделано)*
   - Endpoint `/api/.../boards/:id/alerts` — список задач, чей age > P85 of historical cycle time в той же колонке.
   - UI: панель «Внимание» на доске с count, в карточках — индикатор «stuck».
   - Backend: per-column percentile threshold вычисляется из исторических данных аналогично SLE, но per-column.
2. **Calibration framework для Monte Carlo**
   - Back-testing: брать N дней истории, делать прогноз с горизонтом T дней назад, сравнивать с реальным фактом за этот период. Reports: «P50 прогноз соответствовал реальности в 47% случаев — почти калиброванная модель».
   - Этот раздел — **главная thesis-math часть**, можно публиковать в дипломе как методологию валидации.
3. **Variant analysis на task_events** (mini-process-mining)
   - Каждый task имеет sequence перемещений через columns: например `backlog → in_progress → review → done` или `backlog → in_progress → review → in_progress → review → done`.
   - Endpoint: `/api/.../boards/:id/variants` — топ-N последовательностей с их частотой.
   - UI: список вариантов с happy-path выделением.
4. **Per-CoS analytics**
   - CFD с per-CoS breakdown, throughput по CoS, cycle time scatter с цветом CoS — это closes B pillar gap.
5. **Bottleneck detection**
   - Per-column time-in-column distribution; outlier detection (Z-score или IQR-based) показывает «эта колонка bottleneck по сравнению с другими».

**§3 Deliverables:**
- 4 новых analytics endpoint'а
- UI: alerts panel, variant analyzer view, calibration report view (в /analytics табе)
- Documentation chapter: формализованная методология calibration для диплома

**§4 DoD:**
- Synthetic dataset generator (для testing analytics на known-distribution данных, нужен для validation)
- На synthetic данных Monte Carlo calibration показывает ожидаемое поведение
- Variant analyzer даёт топ-3 пути для тестовой доски
- Percentile alerts реактивно появляются когда задача стареет
- README раздел «как читать calibration report» для thesis-defense narrative

**§5 Зачем:** это и есть «обоснованная математика» из vision. Без T4 защита на тройку. ~2-3 недели; самая math-heavy phase.

---

### Phase 9 — РФ интеграции (T5) — pillar E

**§1 Vision pillars advanced:** Pillar **E** напрямую (импортозамещение, РФ-ниша).

**§2 Что делаем:** реализуем **2 flagship интеграции** + **1 universal webhook** механизм. Не пытаемся сделать все 5 из vision — фокус.

1. **Pachca bot** (incoming): новый Pachca-bot publishing задач в канал команды. Templates: «Sprint X запущен», «Задача Y перенесена в Review», «WIP лимит превышен».
2. **GitFlic webhook** (outgoing/incoming): commit с `#TASK-123` в сообщении → автоматически добавляет комментарий с ссылкой на коммит в task drawer.
3. **Universal webhook outbound**: настройка endpoint URL + events filter → отправка JSON BoardEvent'ов на этот URL. Это закрывает Slack/Telegram/Discord интеграции одной фичей.

**§3 Deliverables:**
- Schema: `integrations (id, workspace_id, type, config jsonb, enabled, created_at)`
- pg-boss queue для outbound webhooks (retry с экспоненциальным backoff)
- UI: integrations settings на workspace level

**§4 DoD:**
- Pachca: тестовое сообщение приходит в канал
- GitFlic: commit с tag → комментарий в задаче
- Webhook: HTTP POST с JSON-телом BoardEvent'а уходит на сконфигурированный URL

**§5 Зачем:** vision pillar E. Тонкая выборка из 5 — выбираем то что **технически реализуемо** и **визуально показуемо на защите**. ~2-3 недели.

---

### Phase 10 — Production readiness (T6)

**§1 Vision pillars advanced:** **Не двигает pillars напрямую.** Это инфра-фаза для (а) live demo на защите, (б) повышения engineering-веса дипломной работы.

**§2 Что делаем:**
1. **Dockerfile** (multi-stage: bun deps → bun build → distroless или alpine runtime)
2. **docker-compose.prod.yml** — app + Postgres 16 + Caddy + (optional) backup sidecar
3. **Caddyfile** — Let's Encrypt TLS + security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy)
4. **pino integration** — structured JSON logs + requestId middleware в каждый endpoint
5. **Sentry** — `@sentry/nuxt` + `@sentry/node`, DSN из env
6. **GitHub Actions CI** — `.github/workflows/ci.yml`: typecheck + vitest + build
7. **pg_dump scheduled backup** → Yandex Object Storage (cron sidecar или systemd timer)
8. **Rate limit** на `/auth/login` (in-memory или Postgres-backed: 5 попыток / 5 мин на email+IP)
9. **Deployment** на Yandex Cloud VM (или Hetzner / любой VPS — твой выбор)
10. **LISTEN/NOTIFY для SSE** при ≥2 репликах (если планируем масштабирование) — иначе оставляем in-process bus

**§3 Deliverables:** все артефакты в `docker/`, `.github/workflows/`, `caddy/`. Live URL.

**§4 DoD:** `docker-compose -f docker-compose.prod.yml up` развёртывает на чистой VM; HTTPS работает; CI зелёный на main; backup сохраняется в Object Storage; rate limit срабатывает на 6-й попытке.

**§5 Зачем:** для защиты — live URL. Для thesis-engineering — production-grade артефакты (Dockerfile, CI, backups) → демонстрация инженерной maturity. ~1-1.5 недели.

---

### Phase 11 — Identity (опционально, T7)

**§1 Vision pillars advanced:** **Не двигает pillars напрямую.** UX polish для реальных пользователей.

**§2 Что делаем:**
1. User profile schema migration (`users` table: firstName, lastName, displayName, avatarUrl, bio)
2. Email verification flow: `email_verification_tokens` table + magic-link send через pg-boss → SMTP
3. Profile page + edit form
4. Аватары интегрируются с TaskCard, TaskDrawer, comments, audit timeline

**§5 Зачем:** для красоты, не для защиты. Если будут силы — делаем. ~1 неделя.

---

### Phase 12 — Empirical study (research extension)

**§1 Vision pillars advanced:** **Pillar B+** — закрывает заявленную «research-эксперимент» строку из vision Results section.

**§2 Что делаем:**
1. **Synthetic dataset generator** — параметризованный генератор данных команд (sprint length, throughput distribution, blocker frequency, team size). Нужен для validation analytics на known-distribution входе.
2. **Реальные данные** — попросить 1-2 знакомые команды попробовать инструмент 2-4 недели, собрать историю.
3. **ML классификатор** «задача с риском задержки» — обучение на собранных task_events.
   - Features: текущая колонка, age, CoS, assignee history, day-of-week, ...
   - Метки: завершилась в пределах SLE / нет.
   - Модели: XGBoost / logistic regression (per vision — не deep learning).
4. **Honest evaluation:**
   - Comparison с baseline (просто percentile-based alerts из Phase 8).
   - Метрики: precision, recall, F1, ROC-AUC.
   - **Ожидаемый честный результат**: ML на малых noisy выборках уступает простой percentile-эвристике. Это и есть thesis-вклад: empirical demonstration of ML limitations on small data → defended choice of statistical methods.
5. **Text writing** — этот эксперимент описывается в thesis main text как Chapter «Применимость ML-подходов к task-delay-prediction».

**§5 Зачем:** этим заканчивается формальная «научно-исследовательская» часть диплома. Без неё работа защищается как инженерная — с ней становится «инженерно-исследовательской». ~3-4 недели, включая writing.

---

## 6. Реалистичный график (8 месяцев до защиты)

| Месяц | Phase | Главный артефакт |
|---|---|---|
| **Май (текущий)** | Phase 5 — Scrumban-distinct | CoS + SLE + aging WIP + pull enforcement |
| Июнь | Phase 6 — Hierarchy | sub-tasks + deps + swimlanes |
| Июнь | Phase 7 — Collaboration | comments + notifications + attachments |
| **~Конец июля — предзащита** | — | Демо: Scrumban-доска с CoS, иерархией, комментариями. Уже defendable как продукт. |
| Август | Phase 8 — Analytics depth | percentile alerts + calibration + variants — **главная thesis-math** |
| Сентябрь | Phase 9 — РФ интеграции | Pachca + GitFlic + universal webhook |
| Октябрь | Phase 10 — Production deploy | live URL + Dockerfile + CI |
| Октябрь-Ноябрь | Phase 11 (опц.) + Phase 12 — empirical study | ML классификатор + сравнение + writing |
| **Декабрь** | — | Thesis writeup, defense rehearsal |
| **Янв 2027** | — | Защита |

Буфер: ~1 месяц на непредвиденное.

---

## 7. Что НЕ делаем (scope exclusion, обновлено)

| Исключение | Причина |
|---|---|
| Кастомные поля на задачах | Усложняет UX и UI form-builder; решается Phase 13+ (post-thesis) |
| Time tracking (журнал часов) | Не critical для Scrumban-методологии; добавим post-thesis |
| Native мобильные приложения | Responsive web в MVP; PWA опционально в Phase 10 |
| Gantt / Calendar / Timeline views | Не Scrumban-specific; Kanban-доска основа продукта |
| Multi-project / portfolio level | Workspace → boards иерархия достаточна; portfolio post-thesis |
| Полный process mining (discovery, conformance) | Vision явно говорит «inspired by, не реализуем» |
| SSO / OAuth (Yandex ID, GitFlic ID) | Email/password + magic-link достаточно для thesis-demo |
| Биллинг + paid plans | Не продукт-MVP, post-thesis |
| Multi-language UI | Только RU в MVP; EN post-thesis |
| Native mobile apps | Web-only |

---

## 8. Definition of Done

### DoD для отдельной фичи
- [ ] Tests: unit (services) + integration (endpoint happy path + ≥1 error path)
- [ ] RLS-guard test если фича затрагивает tenant-scoped таблицы
- [ ] Frontend pages вручную проверены в браузере (e2e walkthrough)
- [ ] Errors: 4xx правильно мапятся в понятный UI alert / toast
- [ ] Документация архитектурного слоя обновлена (если фича меняет архитектуру)
- [ ] Никаких новых TODO в коде без issue-ID или ticket

### DoD для Phase
- [ ] Все features в Phase scope доведены до per-feature DoD
- [ ] **§1 Vision pillars advanced check** заполнено, отвечает на «какой pillar и какой пункт он закрыл»
- [ ] Browser e2e сценарий «как пользователь использует эту фичу» отрабатывается end-to-end
- [ ] Merge в `main` через no-ff merge-commit
- [ ] Phase summary в commit-message: что закрыто, что осталось

### DoD для предзащиты (~июль 2026)
- [ ] Phases 5+6+7 завершены и смержены
- [ ] Демо-сценарий: register → create workspace → create board с custom columns → create задачи с CoS → DnD → aging WIP включается → SLE настроен → swimlanes по assignee работают → comments + notifications → analytics показывает CFD + Monte Carlo + percentile alerts
- [ ] Локальный demo воспроизводится за 5 минут
- [ ] README обновлён под текущее состояние

### DoD для защиты (~янв 2027)
- [ ] Все Phases 5-10 завершены
- [ ] Phase 12 empirical study либо проведён, либо честно описан как «попытались — данных не хватило, поэтому выбран статистический подход»
- [ ] Live URL работает (Phase 10 deploy)
- [ ] Thesis main text написан и согласован с научником
- [ ] Защита-репетиция проведена

---

## 9. Риски и митигация (обновлено)

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Phase 5 (Scrumban-distinct) растягивается | Средняя | Высокое | Выбраны минимально-достаточные 5 фич; CoS и SLE — простой schema, не large refactor |
| Phase 8 (calibration math) тяжело даётся | Высокая | Среднее | Базовая calibration = back-testing P50 на исторических данных; сложный statistical test'ы — post-thesis |
| Phase 9 (РФ интеграции) — Pachca/GitFlic API нестабильны или закрыты | Средняя | Среднее | Если одна не пойдёт — заменяем на universal webhook + email; в крайнем случае один SMTP-канал хватит для demo |
| Empirical study (Phase 12) — не получится найти команды | Высокая | Низкое | Synthetic datasets обеспечивают validation infrastructure; реальные команды — bonus, не critical |
| Усталость / выгорание | Высокая | Высокое | 20 ч/неделю максимум; отпуск после каждой Phase; жёстко режем scope если phase затягивается |
| Vision-drift повторяется (как с Phase 4) | Средняя | Высокое | §1 «Vision pillars advanced» на каждой Phase — обязательный guard rail |

---

## 10. Связанные документы

- [`01-vision-and-goals.md`](01-vision-and-goals.md) — pillars B/B+/E, dual-track Current vs Target
- [`02-target-audience.md`](02-target-audience.md) — кому продаём
- [`03-competitive-analysis.md`](03-competitive-analysis.md) — конкуренты и наша ниша
- [`06-system-architecture.md`](06-system-architecture.md) — архитектура
- [`07-domain-model.md`](07-domain-model.md) — доменная модель (Target-секции описывают будущие расширения)
- [`08-backend-design.md`](08-backend-design.md) — backend-план
- [`09-frontend-design.md`](09-frontend-design.md) — frontend (Phase 4 done)
- [`10-analytics-design.md`](10-analytics-design.md) — детали B и B+ pillar'ов
- [`11-non-functional.md`](11-non-functional.md) — Phase 10 (production) deliverables

---

## 11. История пересборки

**2026-05-11.** Roadmap полностью переписан после критики пользователя. До этой даты документ описывал атомарную CRUD-сборку Phase 1-5 без явной привязки к pillars из vision. После критики: добавлена Section 1 (recap pillars), Section 2 (Scrumban methodology features из web-research), Section 3 (gap-анализ vs Kaiten), Section 4 (честная оценка current state), Section 5 (новые Phases 5-12 с §1 vision-pillar check каждая), реалистичный график на 8 месяцев. Memory rule `feedback_vision_check.md` сохранён в auto-memory чтобы предотвратить повторение vision-drift.

Источники из web-research для Section 2 (Scrumban methodology):

- Agile Alliance — [What is Scrumban?](https://agilealliance.org/scrumban/)
- David Anderson — [Classes of Service in Kanban](https://djaa.com/classes-of-service/)
- ProKanban — [Service Level Expectation chapter](https://www.prokanban.org/blog/https-prokanban-org-blog-the-kanban-pocket-guide-chapter-2-the-service-level-expectation)
- Kanban Tool — [Scrumban guide](https://kanbantool.com/kanban-guide/what-is-scrumban)
- Kaiten — [Kanban feature page](https://kaiten.ru/features/kanban/)