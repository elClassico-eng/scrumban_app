> ## ⚠️ OBSOLETE — Phase 0 пропущен
>
> **Статус:** план не выполнялся, реализация началась сразу с Phase 1.
> **Причина:** на момент 2026-04-26 user принял решение пропустить отдельный pet-project Phase 0 и начать сразу с Phase 1 (RLS-foundation для Scrumban).
> **Зачем сохранён:** показывает рассмотренный learning-путь (Phase 0 как pet-project для освоения TS-backend), отказ от которого — обоснованное решение solo-разработчика с уверенным TS-фоном.

---

# Phase 0 Week 1 — Nuxt Nitro Starter (notes-api)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить простое Notes CRUD API на Nuxt/Nitro + Drizzle + PostgreSQL, освоив весь backend-стек Scrumban на маленьком проекте.

**Architecture:** Nuxt 4 монопроект, `server/api/` — HTTP handlers (Nitro), `server/services/` — бизнес-логика, `server/db/` — Drizzle schema + queries. PostgreSQL в Docker. Без фронтенда (только API).

**Tech Stack:** Node.js 22, **Nuxt 4** (latest stable), Nitro, Drizzle ORM, postgres-js, nuxt-auth-utils, argon2, pino, pg-boss, vitest, testcontainers, Docker Compose.

**Где работаем:** `~/Волгу/магистратура/nuxt-notes-api/` (pet-project, отдельно от Scrumban-репо)

---

## Что построим

REST API для заметок с авторизацией:

```
POST   /api/auth/register   — регистрация
POST   /api/auth/login      — вход (session cookie)
POST   /api/auth/logout     — выход
GET    /api/auth/session    — текущий пользователь

GET    /api/notes           — все заметки текущего пользователя
POST   /api/notes           — создать заметку
GET    /api/notes/:id       — одна заметка
PATCH  /api/notes/:id       — обновить
DELETE /api/notes/:id       — удалить
```

---

## Файлы (итоговая структура)

```
nuxt-notes-api/
├── nuxt.config.ts
├── package.json
├── drizzle.config.ts
├── docker-compose.yml
├── .env
├── .env.example
├── server/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register.post.ts
│   │   │   ├── login.post.ts
│   │   │   ├── logout.post.ts
│   │   │   └── session.get.ts
│   │   └── notes/
│   │       ├── index.get.ts
│   │       ├── index.post.ts
│   │       ├── [id].get.ts
│   │       ├── [id].patch.ts
│   │       └── [id].delete.ts
│   ├── services/
│   │   ├── notes.service.ts
│   │   └── users.service.ts
│   ├── db/
│   │   ├── schema/
│   │   │   ├── index.ts
│   │   │   ├── users.ts
│   │   │   └── notes.ts
│   │   └── index.ts
│   ├── plugins/
│   │   └── logger.ts
│   └── utils/
│       └── db.ts
├── drizzle/
│   └── migrations/
└── tests/
    ├── unit/
    │   └── notes.service.test.ts
    └── integration/
        └── notes.db.test.ts
```

---

### Task 1: Инициализировать проект

**Files:**
- Create: `~/Волгу/магистратура/nuxt-notes-api/` (весь проект)

- [ ] **Step 1: Создать Nuxt-проект**

```bash
cd ~/Волгу/магистратура
npx nuxi@latest init nuxt-notes-api
cd nuxt-notes-api
```

При вопросах nuxi: выбрать `npm` / `pnpm` (предпочтительно pnpm если установлен), остальное по умолчанию.

Проверить что создалось:
```bash
ls
# nuxt.config.ts  package.json  app.vue  ...
```

- [ ] **Step 2: Установить зависимости**

```bash
pnpm install

# production deps
pnpm add drizzle-orm postgres nuxt-auth-utils pino pg-boss zod

# dev deps
pnpm add -D drizzle-kit @types/pg vitest @nuxt/test-utils @testcontainers/postgresql
```

- [ ] **Step 3: Обновить nuxt.config.ts**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: ['nuxt-auth-utils'],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || '',
  },
})
```

- [ ] **Step 4: Создать .env и .env.example**

```bash
# .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notes_dev
NUXT_SESSION_PASSWORD=changeme-at-least-32-chars-long-please
```

```bash
# .env.example
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notes_dev
NUXT_SESSION_PASSWORD=changeme-at-least-32-chars-long-please
```

Добавить `.env` в `.gitignore` (`.env.example` коммитим):
```bash
echo ".env" >> .gitignore
echo "node_modules/" >> .gitignore
echo ".nuxt/" >> .gitignore
echo ".output/" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git init
git add .
git commit -m "feat: init Nuxt project with deps"
```

---

### Task 2: Docker Compose + PostgreSQL

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Создать docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: notes_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

- [ ] **Step 2: Запустить PostgreSQL**

```bash
docker compose up -d
```

Подождать ~5 секунд, проверить:
```bash
docker compose ps
# postgres  running (healthy)
```

- [ ] **Step 3: Проверить соединение**

```bash
docker exec -it nuxt-notes-api-postgres-1 psql -U postgres -d notes_dev -c "SELECT version();"
# PostgreSQL 16.x ...
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .gitignore
git commit -m "feat: add PostgreSQL via docker-compose"
```

---

### Task 3: Drizzle ORM — schema и конфиг

**Files:**
- Create: `drizzle.config.ts`
- Create: `server/db/schema/users.ts`
- Create: `server/db/schema/notes.ts`
- Create: `server/db/schema/index.ts`
- Create: `server/utils/db.ts`

- [ ] **Step 1: drizzle.config.ts**

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './server/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

- [ ] **Step 2: server/db/schema/users.ts**

```typescript
// server/db/schema/users.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

- [ ] **Step 3: server/db/schema/notes.ts**

```typescript
// server/db/schema/notes.ts
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
```

- [ ] **Step 4: server/db/schema/index.ts**

```typescript
// server/db/schema/index.ts
export * from './users'
export * from './notes'
```

- [ ] **Step 5: server/utils/db.ts**

```typescript
// server/utils/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

let _db: ReturnType<typeof drizzle> | null = null

export function useDB() {
  if (!_db) {
    const config = useRuntimeConfig()
    const client = postgres(config.databaseUrl)
    _db = drizzle(client, { schema })
  }
  return _db
}
```

> **Объяснение:** `useRuntimeConfig()` — Nuxt auto-import, читает значения из `nuxt.config.ts → runtimeConfig`. `useDB()` — singleton: соединение создаётся один раз, переиспользуется во всём приложении. Nitro auto-import подхватывает `server/utils/` автоматически.

- [ ] **Step 6: Commit**

```bash
git add drizzle.config.ts server/
git commit -m "feat: add Drizzle schema (users, notes) + db util"
```

---

### Task 4: Первая миграция

**Files:**
- Create: `drizzle/migrations/` (автогенерация)

- [ ] **Step 1: Добавить scripts в package.json**

В `package.json` добавить в секцию `"scripts"`:

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 2: Сгенерировать миграцию**

```bash
pnpm db:generate
```

Ожидаемый вывод:
```
1 migration file generated: drizzle/migrations/0000_initial.sql
```

Посмотреть что внутри:
```bash
cat drizzle/migrations/0000_initial.sql
# CREATE TABLE IF NOT EXISTS "users" ( ... )
# CREATE TABLE IF NOT EXISTS "notes" ( ... )
```

- [ ] **Step 3: Применить миграцию**

```bash
pnpm db:migrate
```

Ожидаемый вывод:
```
Applying migration: 0000_initial.sql
Done!
```

Проверить в базе:
```bash
docker exec -it nuxt-notes-api-postgres-1 psql -U postgres -d notes_dev -c "\dt"
#  users | table | postgres
#  notes | table | postgres
```

- [ ] **Step 4: Commit**

```bash
git add drizzle/ package.json
git commit -m "feat: add initial DB migration (users + notes tables)"
```

---

### Task 5: UsersService — чистые функции

**Files:**
- Create: `server/services/users.service.ts`

- [ ] **Step 1: Создать server/services/users.service.ts**

```typescript
// server/services/users.service.ts
import { eq } from 'drizzle-orm'
import { users, type NewUser, type User } from '../db/schema'

export async function createUser(data: { email: string; passwordHash: string }): Promise<User> {
  const db = useDB()
  const [user] = await db.insert(users).values(data).returning()
  return user
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const db = useDB()
  const [user] = await db.select().from(users).where(eq(users.email, email))
  return user
}

export async function findUserById(id: string): Promise<User | undefined> {
  const db = useDB()
  const [user] = await db.select().from(users).where(eq(users.id, id))
  return user
}
```

> **Объяснение:** Сервис — это просто функции, которые работают с БД. Они не знают ничего про HTTP (нет `event`, нет `req/res`). Handler вызывает сервис и форматирует ответ. Это и есть разделение ответственности.

- [ ] **Step 2: Commit**

```bash
git add server/services/
git commit -m "feat: add UsersService"
```

---

### Task 6: Auth endpoints

**Files:**
- Create: `server/api/auth/register.post.ts`
- Create: `server/api/auth/login.post.ts`
- Create: `server/api/auth/logout.post.ts`
- Create: `server/api/auth/session.get.ts`

- [ ] **Step 1: register.post.ts**

```typescript
// server/api/auth/register.post.ts
import { z } from 'zod'
import { hashPassword } from '#auth-utils'
import { createUser, findUserByEmail } from '../../services/users.service'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, RegisterSchema.parse)

  const existing = await findUserByEmail(body.email)
  if (existing) throw createError({ statusCode: 409, message: 'Email already registered' })

  const passwordHash = await hashPassword(body.password)
  const user = await createUser({ email: body.email, passwordHash })

  await setUserSession(event, { userId: user.id })

  return { id: user.id, email: user.email }
})
```

> **Объяснение:**
> - `readValidatedBody` — читает body и прогоняет через zod. Если валидация не прошла — автоматически бросает 422.
> - `hashPassword` — из `nuxt-auth-utils`, argon2id под капотом.
> - `setUserSession` — подписывает cookie и ставит его в ответ.
> - `defineEventHandler` — обёртка Nitro для handler-функции (Nitro auto-import).

- [ ] **Step 2: login.post.ts**

```typescript
// server/api/auth/login.post.ts
import { z } from 'zod'
import { verifyPassword } from '#auth-utils'
import { findUserByEmail } from '../../services/users.service'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, LoginSchema.parse)

  const user = await findUserByEmail(body.email)
  if (!user || !await verifyPassword(user.passwordHash, body.password))
    throw createError({ statusCode: 401, message: 'Invalid email or password' })

  await setUserSession(event, { userId: user.id })

  return { id: user.id, email: user.email }
})
```

- [ ] **Step 3: logout.post.ts**

```typescript
// server/api/auth/logout.post.ts
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
```

- [ ] **Step 4: session.get.ts**

```typescript
// server/api/auth/session.get.ts
import { findUserById } from '../../services/users.service'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.userId) throw createError({ statusCode: 401 })

  const user = await findUserById(session.userId)
  if (!user) throw createError({ statusCode: 401 })

  return { id: user.id, email: user.email }
})
```

- [ ] **Step 5: Запустить dev-сервер и проверить**

```bash
pnpm dev
```

Открыть второй терминал и проверить регистрацию:

```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq
# { "id": "...", "email": "test@example.com" }
```

Проверить сессию:
```bash
curl -s -b cookies.txt http://localhost:3000/api/auth/session | jq
# { "id": "...", "email": "test@example.com" }
```

- [ ] **Step 6: Commit**

```bash
git add server/api/auth/
git commit -m "feat: add auth endpoints (register, login, logout, session)"
```

---

### Task 7: NotesService + Notes endpoints

**Files:**
- Create: `server/services/notes.service.ts`
- Create: `server/api/notes/index.get.ts`
- Create: `server/api/notes/index.post.ts`
- Create: `server/api/notes/[id].get.ts`
- Create: `server/api/notes/[id].patch.ts`
- Create: `server/api/notes/[id].delete.ts`

- [ ] **Step 1: server/services/notes.service.ts**

```typescript
// server/services/notes.service.ts
import { eq, and } from 'drizzle-orm'
import { notes, type Note, type NewNote } from '../db/schema'

export async function listNotes(userId: string): Promise<Note[]> {
  const db = useDB()
  return db.select().from(notes).where(eq(notes.userId, userId))
}

export async function createNote(data: { userId: string; title: string; content?: string }): Promise<Note> {
  const db = useDB()
  const [note] = await db.insert(notes).values({
    userId: data.userId,
    title: data.title,
    content: data.content ?? '',
  }).returning()
  return note
}

export async function getNoteByIdAndUser(id: string, userId: string): Promise<Note | undefined> {
  const db = useDB()
  const [note] = await db.select().from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
  return note
}

export async function updateNote(id: string, userId: string, data: { title?: string; content?: string }): Promise<Note | undefined> {
  const db = useDB()
  const [note] = await db.update(notes)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning()
  return note
}

export async function deleteNote(id: string, userId: string): Promise<boolean> {
  const db = useDB()
  const result = await db.delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
  return (result.rowCount ?? 0) > 0
}
```

> **Ключевой момент:** `and(eq(notes.id, id), eq(notes.userId, userId))` — это авторизация на уровне данных. Пользователь видит только свои заметки, и DELETE/UPDATE тоже работает только по своим. Аналог RLS из Scrumban, но в коде сервиса.

- [ ] **Step 2: Вспомогательная функция requireAuth**

Создать `server/utils/auth.ts`:

```typescript
// server/utils/auth.ts
import type { H3Event } from 'h3'

export async function requireAuth(event: H3Event): Promise<string> {
  const session = await getUserSession(event)
  if (!session?.userId) throw createError({ statusCode: 401, message: 'Unauthorized' })
  return session.userId
}
```

- [ ] **Step 3: server/api/notes/index.get.ts**

```typescript
// server/api/notes/index.get.ts
import { listNotes } from '../../services/notes.service'

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event)
  return listNotes(userId)
})
```

- [ ] **Step 4: server/api/notes/index.post.ts**

```typescript
// server/api/notes/index.post.ts
import { z } from 'zod'
import { createNote } from '../../services/notes.service'

const CreateNoteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event)
  const body = await readValidatedBody(event, CreateNoteSchema.parse)
  return createNote({ userId, ...body })
})
```

- [ ] **Step 5: server/api/notes/[id].get.ts**

```typescript
// server/api/notes/[id].get.ts
import { getNoteByIdAndUser } from '../../../services/notes.service'

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const note = await getNoteByIdAndUser(id, userId)
  if (!note) throw createError({ statusCode: 404 })
  return note
})
```

- [ ] **Step 6: server/api/notes/[id].patch.ts**

```typescript
// server/api/notes/[id].patch.ts
import { z } from 'zod'
import { updateNote } from '../../../services/notes.service'

const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
}).refine(d => d.title !== undefined || d.content !== undefined, {
  message: 'At least one field required',
})

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, UpdateNoteSchema.parse)
  const note = await updateNote(id, userId, body)
  if (!note) throw createError({ statusCode: 404 })
  return note
})
```

- [ ] **Step 7: server/api/notes/[id].delete.ts**

```typescript
// server/api/notes/[id].delete.ts
import { deleteNote } from '../../../services/notes.service'

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const deleted = await deleteNote(id, userId)
  if (!deleted) throw createError({ statusCode: 404 })
  return { ok: true }
})
```

- [ ] **Step 8: Проверить CRUD через curl**

Убедись что dev-сервер запущен (`pnpm dev`) и есть cookies.txt с сессией из Task 6.

```bash
# Создать заметку
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Первая заметка","content":"Контент заметки"}' | jq
# { "id": "...", "title": "Первая заметка", ... }

# Список заметок
curl -s -b cookies.txt http://localhost:3000/api/notes | jq

# Обновить (подставь реальный id)
curl -s -b cookies.txt -X PATCH http://localhost:3000/api/notes/<id> \
  -H "Content-Type: application/json" \
  -d '{"title":"Обновлённая заметка"}' | jq

# Удалить
curl -s -b cookies.txt -X DELETE http://localhost:3000/api/notes/<id> | jq
# { "ok": true }
```

- [ ] **Step 9: Commit**

```bash
git add server/services/notes.service.ts server/utils/auth.ts server/api/notes/
git commit -m "feat: add NotesService + CRUD API endpoints"
```

---

### Task 8: pino logger

**Files:**
- Create: `server/plugins/logger.ts`
- Modify: `server/api/auth/login.post.ts` (добавить лог)

- [ ] **Step 1: server/plugins/logger.ts**

```typescript
// server/plugins/logger.ts
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})

export default defineNitroPlugin(() => {
  // Кладём logger в globalThis чтобы он был доступен из utils
  globalThis.__logger = logger
})

export function useLogger(component: string) {
  return (globalThis.__logger as pino.Logger).child({ component })
}
```

> **Объяснение:** `defineNitroPlugin` запускается один раз при старте сервера. Мы создаём logger, кладём в `globalThis` (глобальный объект Node.js). `useLogger('auth')` возвращает дочерний логгер с полем `component` — в логах видно откуда пришёл лог.

- [ ] **Step 2: Добавить pino-pretty для dev**

```bash
pnpm add -D pino-pretty
```

- [ ] **Step 3: Добавить лог в login.post.ts**

После строки с `findUserByEmail`:

```typescript
// Добавить в начало файла:
import { useLogger } from '../../plugins/logger'
const logger = useLogger('auth')

// Внутри handler, после успешного входа:
logger.info({ userId: user.id }, 'user logged in')
```

- [ ] **Step 4: Проверить**

Выполнить `curl` на `/api/auth/login` и увидеть в консоли dev-сервера:

```
INFO (auth): user logged in  userId=...
```

- [ ] **Step 5: Commit**

```bash
git add server/plugins/logger.ts server/api/auth/login.post.ts
git commit -m "feat: add pino structured logger"
```

---

### Task 9: Unit тест — NotesService

**Files:**
- Create: `tests/unit/notes.service.test.ts`
- Modify: `package.json` (test script)

- [ ] **Step 1: Добавить test script в package.json**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Создать vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Написать тест для NotesService**

Для unit-теста замокируем `useDB()`:

```typescript
// tests/unit/notes.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мок useDB — заменяем реальный DB пустышкой
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../../server/utils/db', () => ({
  useDB: () => mockDb,
}))

// Нам нужен мок Nitro auto-imports (в тестах они не работают автоматически)
vi.stubGlobal('useDB', () => mockDb)

describe('NotesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listNotes вызывает select с правильным userId', async () => {
    const fakeNotes = [
      { id: '1', userId: 'user-1', title: 'Test', content: '', createdAt: new Date(), updatedAt: new Date() },
    ]

    // Цепочка drizzle: select().from().where() → возвращает массив
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(fakeNotes),
      }),
    })

    const { listNotes } = await import('../../server/services/notes.service')
    const result = await listNotes('user-1')

    expect(result).toEqual(fakeNotes)
    expect(mockDb.select).toHaveBeenCalledOnce()
  })
})
```

> **Почему такой мок?** Drizzle — query builder с цепочками `.select().from().where()`. Мокируем каждый шаг цепочки, чтобы не нужна была реальная БД. Это unit-тест — проверяем что функция ВЫЗЫВАЕТ правильные методы с правильными аргументами. Реальное поведение БД — в integration-тесте.

- [ ] **Step 4: Запустить тест**

```bash
pnpm test
```

Ожидаемый вывод:
```
✓ tests/unit/notes.service.test.ts (1)
  ✓ NotesService > listNotes вызывает select с правильным userId

Test Files  1 passed (1)
Tests       1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add tests/ vitest.config.ts
git commit -m "test: add unit test for NotesService"
```

---

### Task 10: Integration тест с testcontainers

**Files:**
- Create: `tests/integration/notes.db.test.ts`

- [ ] **Step 1: Написать integration тест**

```typescript
// tests/integration/notes.db.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from '../../server/db/schema'
import { eq, and } from 'drizzle-orm'

let container: StartedPostgreSqlContainer
let db: ReturnType<typeof drizzle>
let client: ReturnType<typeof postgres>

beforeAll(async () => {
  // Запустить реальный PostgreSQL в Docker-контейнере
  container = await new PostgreSqlContainer('postgres:16-alpine').start()

  client = postgres(container.getConnectionUri())
  db = drizzle(client, { schema })

  // Применить миграции из drizzle/migrations/
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
}, 60_000) // timeout 60с — контейнер может запускаться долго

afterAll(async () => {
  await client.end()
  await container.stop()
})

describe('Notes DB integration', () => {
  it('создаёт пользователя и заметку, возвращает только его заметки', async () => {
    // Создать двух пользователей
    const [userA] = await db.insert(schema.users).values({
      email: 'a@test.com',
      passwordHash: 'hash',
    }).returning()

    const [userB] = await db.insert(schema.users).values({
      email: 'b@test.com',
      passwordHash: 'hash',
    }).returning()

    // Заметка пользователя A
    const [noteA] = await db.insert(schema.notes).values({
      userId: userA.id,
      title: 'Заметка A',
      content: 'Контент A',
    }).returning()

    // Заметка пользователя B
    await db.insert(schema.notes).values({
      userId: userB.id,
      title: 'Заметка B',
    }).returning()

    // Пользователь A видит только свои заметки
    const notesA = await db.select().from(schema.notes)
      .where(eq(schema.notes.userId, userA.id))

    expect(notesA).toHaveLength(1)
    expect(notesA[0].title).toBe('Заметка A')
    expect(notesA[0].id).toBe(noteA.id)
  })

  it('update обновляет только запись нужного пользователя', async () => {
    const [user] = await db.insert(schema.users).values({
      email: 'c@test.com',
      passwordHash: 'hash',
    }).returning()

    const [note] = await db.insert(schema.notes).values({
      userId: user.id,
      title: 'Оригинальное название',
    }).returning()

    await db.update(schema.notes)
      .set({ title: 'Обновлённое название', updatedAt: new Date() })
      .where(and(eq(schema.notes.id, note.id), eq(schema.notes.userId, user.id)))

    const [updated] = await db.select().from(schema.notes)
      .where(eq(schema.notes.id, note.id))

    expect(updated.title).toBe('Обновлённое название')
  })
})
```

> **Почему testcontainers?** Мы запускаем РЕАЛЬНЫЙ PostgreSQL в изолированном Docker-контейнере. Тест проверяет реальное поведение: миграции применяются, запросы работают, данные изолированы между пользователями. Это важнее unit-тестов с моками — именно здесь можно поймать ошибки в SQL и схеме.

- [ ] **Step 2: Запустить integration тест**

Убедись что Docker запущен. Затем:

```bash
pnpm test
```

Ожидаемый вывод (может занять 10-30 секунд при первом запуске):
```
✓ tests/unit/notes.service.test.ts (1)
✓ tests/integration/notes.db.test.ts (2)
  ✓ создаёт пользователя и заметку, возвращает только его заметки
  ✓ update обновляет только запись нужного пользователя

Test Files  2 passed (2)
Tests       3 passed (3)
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/
git commit -m "test: add integration tests with testcontainers (real PostgreSQL)"
```

---

### Task 11: Docker build для приложения

**Files:**
- Create: `Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Создать Dockerfile**

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Финальный образ
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Добавить app-сервис в docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: notes_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/notes_dev
      NUXT_SESSION_PASSWORD: changeme-at-least-32-chars-long-please
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

- [ ] **Step 3: Собрать и запустить**

```bash
# Остановить dev-сервер если запущен (Ctrl+C)
docker compose up --build
```

Ожидаемый вывод:
```
app-1  | Listening on http://0.0.0.0:3000
```

Проверить:
```bash
curl -s http://localhost:3000/api/auth/session
# { "statusCode": 401, "message": "Unauthorized" }  — правильно, нет сессии
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Dockerfile + docker-compose with app service"
```

---

## Итог

После выполнения всех задач у тебя есть:

- **Рабочий REST API** с auth и CRUD, полностью на Nuxt/Nitro
- **Drizzle ORM** с реальными SQL-миграциями — понимаешь как это работает
- **Session auth** через HTTP-only cookie + argon2id — тот же подход что в Scrumban
- **pino** structured logging
- **Unit тест** с моком БД
- **Integration тест** на реальном PostgreSQL через testcontainers
- **Docker build** готов к деплою

Этого достаточно чтобы уверенно начинать Phase 1 Scrumban: та же структура, те же паттерны, но уже с multi-tenancy (RLS) и real-time (SSE).

---

## Что дальше (Phase 0 Week 2–3, опционально)

- **pg-boss** — добавить одну фоновую задачу (например, отправка "welcome email" после регистрации, пока просто `console.log`)
- **SSE** — endpoint `/api/notes/stream` который шлёт событие при создании новой заметки, фронт (`useEventSource`) подписывается
- **RLS** — добавить PostgreSQL-политику вместо `WHERE userId = ?` в сервисе, убедиться что работает

Каждый из этих пунктов — прямой прообраз фичи Scrumban Phase 1–2.
