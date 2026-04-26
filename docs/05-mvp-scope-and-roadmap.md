# 05 — MVP Scope & Roadmap

## Scope MVP (к предзащите, месяц 3)

Цель демо: показать работоспособный Scrumban-инструмент с уникальным ядром аналитики. История демо: «вот доска и спринты — стандарт; а вот наша фишка — дашборд процесса с CFD, узкими местами и Monte Carlo прогнозом».

### MUST (без этого MVP не имеет смысла)

#### Базовая работа
1. Email/password аутентификация + восстановление пароля (email link).
2. Создание/управление workspace; приглашение по email.
3. Несколько проектов в workspace.
4. Доска с drag-n-drop колонок и задач.
5. Задачи: title, description (markdown), assignee, priority, type, tags, status (=колонка).
6. Комментарии с историей изменений.
7. Базовый RBAC: owner / admin / member / viewer.

#### Scrum-часть
8. Бэклог проекта.
9. Спринты: CRUD, старт, закрытие.
10. Story points + velocity.
11. Burndown chart.

#### Kanban + B-ядро (наш дифференциатор)
12. WIP-лимиты на колонках (soft — визуальное предупреждение).
13. Cycle time / Lead time — сбор данных при переходах.
14. **Cumulative Flow Diagram (CFD) — главный визуал демо.**
15. Throughput chart.
16. Дашборд «здоровье процесса»: bottleneck detection + Monte Carlo прогноз спринта.

### SHOULD (если успеваем)
- Файлы/вложения к задачам (Object Storage).
- Scatter plot cycle time с percentile-аналитикой.
- Сравнение спринтов / периодов.
- Telegram-бот для уведомлений.
- SSE live-обновление доски.

### LATER (месяцы 4–9 до защиты)

#### B+ развитие
- Кросс-командная (multi-project) аналитика.
- Little's Law рекомендации по WIP.
- Percentile-based alerts на застрявшие задачи.

#### Research extension
- Сбор исторических данных из тестовых команд.
- Эксперимент: XGBoost / логистическая регрессия на задаче «task will be delayed».
- Публикация методологии и результатов в тексте диплома.

#### E (интеграции)
- Webhook'и (универсально).
- Pachca/VK Teams бот.
- GitFlic/GitVerse привязка коммитов к задачам.
- Импорт из Jira/Trello/Kaiten.

#### Enterprise
- Audit log.
- SSO (OAuth, SAML).
- Биллинг (ЮKassa / CloudPayments) с тарифами.
- On-prem deploy pack.

## Явно исключено из scope

| Исключение | Причина |
|------------|---------|
| Кастомные поля на задачах | Переусложнение; закрывается только enterprise-уровнем |
| Множественные доски в одном проекте | Усложняет UX; 1-project = 1-board в MVP |
| Sub-tasks / checklists | Переусложнение доменной модели |
| Epic → Story → Task иерархия | MVP: плоские задачи с полем type |
| Time tracking (журнал времени) | Только estimate; реальные часы — LATER |
| Нативные мобильные приложения | Адаптивный web-UX в MVP |
| Полный process mining (discovery, conformance) | Вне scope диплома и продукта |
| Multi-language UI | RU+EN в LATER |

## Roadmap по фазам

### Фаза 0 — Подготовка (пропущена, 2026-04-26)
**Изначально:** учебный pet-project Nitro starter (`docs/superpowers/plans/2026-04-23-phase0-week1-nitro-starter.md`) для освоения стека. **После решения 2026-04-26:** Phase 0 пропускается — backend пишет Claude, user обучается через ревью реального Scrumban-кода. Plan-файл оставлен в репо как референс рабочего setup'а Nuxt+Nitro+Drizzle.

### Фаза 1 — MVP Foundation (месяц 1)
**Цель:** скелет системы, на котором можно наращивать фичи.
- Nuxt 4 monorepo: `app/` (frontend) + `server/` (Nitro backend).
- OpenAPI контракт code-first из zod-схем → `openapi/scrumban.yaml`.
- Базовая schema БД: User, Workspace, WorkspaceMember, Invitation (Drizzle).
- Auth endpoints через nuxt-auth-utils: register, login, logout, password reset.
- Минимальные Nuxt-страницы: login, dashboard-заглушка.
- CI/CD pipeline (GitHub Actions): typecheck, vitest, build.
- Docker Compose для dev (PostgreSQL).

**Критерий выхода:** пользователь может зарегистрироваться и залогиниться, frontend видит данные user'а.

### Фаза 2 — Board & Tasks (месяц 2)
**Цель:** работающая Scrumban-доска.
- Модели: Project, Board, Column, Task, TaskComment.
- API: CRUD проектов/досок/задач, drag-n-drop (move-task endpoint).
- Frontend: страница доски с колонками, DnD задач (vuedraggable), детальный view задачи с комментариями.
- RBAC middleware в backend.
- Первые тесты (unit на services, integration на API).

**Критерий выхода:** команда может вести задачи на доске, базовый happy path работает.

### Фаза 3 — Sprints & Basic Analytics (месяц 3)
**Цель:** готовность к демо предзащиты.
- Модели: Sprint, TaskSprint-связь, Event, flow_daily агрегат.
- API спринтов (create, plan, start, close).
- Запись событий (task_moved, task_closed, sprint_started, ...).
- Инкрементальное обновление flow_daily агрегата.
- Backend: расчёт CFD, throughput, cycle time percentiles, Monte Carlo прогноз спринта.
- Frontend: страница «Dashboard процесса» с 3 главными графиками.
- Burndown chart.
- Подготовка sandbox-данных для демо.
- Первый деплой на Yandex Cloud VM.

**Критерий выхода:** демо-сценарий пошагово работает на staging; CFD и прогноз показывают осмысленные числа.

### Фаза 4 — B+ углубление (месяцы 4–5)
- Scatter plot + percentile alerts.
- Little's Law рекомендации по WIP.
- Сравнение спринтов.
- SSE live-обновления.
- Файлы/вложения в Object Storage.
- Telegram/Pachca уведомления.

### Фаза 5 — Multi-tenancy hardening (месяц 6)
- Полноценный RLS в Postgres.
- Audit log.
- Feature flags система.
- Мульти-workspace UI.
- Первые интеграции (webhook + GitFlic).

### Фаза 6 — Research & Documentation (месяц 7)
- Сбор исторических данных из тестовых команд.
- ML эксперимент: обучение XGBoost / логистической регрессии.
- Валидация, честный отчёт о применимости и ограничениях.
- Написание основного текста диплома.

### Фаза 7 — Production polish & Defense (месяцы 8–9)
- Observability (Sentry + basic OTel).
- Backups + restore-тесты.
- Security review (checklist).
- Биллинг скелет (по готовности).
- Доработки по feedback ревьюеров.
- Подготовка к защите: презентация, демо-скрипт, ответы на потенциальные вопросы.

## Критерии готовности (DoD)

### DoD для фичи (любой)
- [ ] Спецификация OpenAPI обновлена, типы регенерированы на обе стороны.
- [ ] Unit-тесты на бизнес-логику (services).
- [ ] Integration-тесты на happy path API endpoint'ов.
- [ ] RLS-guard test если фича затрагивает tenant-scoped таблицы.
- [ ] Frontend-страница работает в браузере (ручная проверка).
- [ ] Error paths обработаны (404, 403, валидация).
- [ ] Документация обновлена, если фича меняет архитектуру.
- [ ] Нет новых TODO в коде без ticket-ID.

### DoD MVP (месяц 3)
- [ ] Все MUST-фичи реализованы.
- [ ] Демо-сценарий воспроизводится end-to-end на staging.
- [ ] Monte Carlo прогноз даёт правдоподобные числа на sandbox-данных.
- [ ] CFD, throughput, cycle time работают с минимум 30 завершёнными задачами за 3 спринта.
- [ ] Docker Compose запускается на чистой машине.
- [ ] README описывает setup локально и на Yandex Cloud.
- [ ] Основные тесты (unit + integration) проходят в CI.

### DoD к защите (месяц 9)
- [ ] Target-state архитектура из соответствующих документов реализована.
- [ ] Research-эксперимент проведён, результаты описаны в дипломе.
- [ ] 3+ тестовых команды использовали продукт, собрана обратная связь.
- [ ] Инфраструктура готова к платным пользователям.
- [ ] Текст диплома соответствует состоянию кода.

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Backend (Nitro/Drizzle/pg-boss) новые библиотеки для user'а | Низкая | Среднее | Backend пишет Claude; user учится через ревью; экосистема стандартная |
| Недостаточно данных для Monte Carlo к демо | Высокая | Среднее | Sandbox-данные генерируются скриптом из статистических распределений |
| Переусложнение в процессе | Средняя | Высокое | Двухнедельные review спецификации: ничего нового, не запланированного заранее |
| Баги в RLS → утечка данных | Низкая | Критическое | RLS-guard test в CI обязателен |
| Сбой инфры перед демо | Низкая | Высокое | Staging-инсталляция отделена от dev; репетиция демо за 3 дня |
| Усталость / выгорание соло | Высокая | Высокое | Максимум 20 ч/неделю; отпуск после каждой фазы; ранние итерации minimal |

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — архитектура под этот scope
- [`08-backend-design.md`](08-backend-design.md) — backend-план
- [`10-analytics-design.md`](10-analytics-design.md) — детали аналитики