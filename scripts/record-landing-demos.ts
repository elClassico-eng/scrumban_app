// Records the landing demo videos against a local dev server with seeded data.
// Usage: bun run db:seed && node scripts/record-landing-demos.ts
// Raw recordings land in .landing-demos/raw; convert them with scripts/encode-landing-demos.sh.
import { mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type BrowserContext, type Page } from '@playwright/test'
import postgres from 'postgres'

const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000'
const OWNER = { email: process.env.SEED_OWNER_EMAIL ?? 'demo@takt.local', password: process.env.SEED_OWNER_PASSWORD ?? 'takt-demo-local-2026' }
const RAW_DIR = join(process.cwd(), '.landing-demos', 'raw')
const VIEWPORT = { width: 1440, height: 900 }
const ONLY = process.argv.slice(2)

type Ids = { ws: string, board: string, sprint: string }

async function seededIds(): Promise<Ids> {
  const sql = postgres(process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL ?? '', { max: 1 })
  try {
    const [row] = await sql`
      SELECT w.id AS ws, b.id AS board, s.id AS sprint
      FROM workspaces w JOIN boards b ON b.workspace_id = w.id
      JOIN sprints s ON s.board_id = b.id AND s.state = 'active'
      WHERE w.slug = 'dostavka'`
    if (!row) throw new Error('Demo workspace not found – run `bun run db:seed` first')
    return row as unknown as Ids
  }
  finally {
    await sql.end()
  }
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms)

async function slowType(page: Page, label: string, text: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.keyboard.type(text, { delay: 55 })
}

async function login(ctx: BrowserContext) {
  const res = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: OWNER,
    headers: { 'x-forwarded-for': `10.240.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
  })
  if (!res.ok()) throw new Error(`Demo login failed: ${res.status()} – run \`bun run db:seed\``)
}

async function drag(page: Page, cardText: string, targetColumn: string) {
  const card = page.getByText(cardText, { exact: true }).first()
  const target = page.getByText(targetColumn, { exact: true }).first()
  const from = (await card.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2, { steps: 12 })
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 10, { steps: 6 })
  await page.mouse.move(to.x + 60, to.y + 120, { steps: 40 })
  await pause(page, 250)
  await page.mouse.up()
}

const SCENES: Record<string, (page: Page, ctx: BrowserContext, ids: Ids) => Promise<void>> = {
  async workspace(page) {
    await page.goto(`${BASE}/register`)
    await pause(page, 900)
    await slowType(page, 'Фамилия', 'Смирнова')
    await slowType(page, 'Имя', 'Ольга')
    await pause(page, 300)
    await page.getByRole('button', { name: 'Дальше' }).click()
    await pause(page, 500)
    await slowType(page, 'Email', `olga.${Date.now()}@new.demo.seed`)
    await slowType(page, 'Пароль', 'Demo-password-2026')
    await slowType(page, 'Повторите пароль', 'Demo-password-2026')
    await page.getByRole('checkbox').check()
    await pause(page, 400)
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()
    await page.waitForURL('**/workspaces', { timeout: 20_000 })
    await pause(page, 1200)
    await page.getByRole('button', { name: 'Создать workspace' }).first().click()
    await pause(page, 600)
    await slowType(page, 'Название', 'Мобильная команда')
    await pause(page, 400)
    await page.getByRole('button', { name: 'Создать', exact: true }).click()
    await pause(page, 2500)
  },

  async board(page, ctx, ids) {
    await login(ctx)
    await page.goto(`${BASE}/workspaces/${ids.ws}/boards/${ids.board}`)
    await page.getByText('Готово к работе', { exact: true }).first().waitFor()
    await pause(page, 1200)
    await drag(page, 'Корзина: напоминание о брошенном заказе', 'Готово к работе')
    await pause(page, 1500)
    await drag(page, 'Поиск: голосовой ввод', 'В работе')
    await pause(page, 2500)
  },

  async sprint(page, ctx, ids) {
    await login(ctx)
    await page.goto(`${BASE}/workspaces/${ids.ws}/boards/${ids.board}/sprints`)
    await pause(page, 2500)
    await page.mouse.wheel(0, 500)
    await pause(page, 1800)
    await page.mouse.wheel(0, 500)
    await pause(page, 1800)
  },

  async flow(page, ctx, ids) {
    await login(ctx)
    await page.goto(`${BASE}/workspaces/${ids.ws}/boards/${ids.board}/analytics`)
    await pause(page, 3000)
    await page.mouse.move(700, 450, { steps: 25 })
    await pause(page, 1200)
    await page.mouse.wheel(0, 600)
    await pause(page, 2200)
    await page.mouse.move(900, 500, { steps: 25 })
    await pause(page, 1500)
  },

  async forecast(page, ctx, ids) {
    await login(ctx)
    await page.goto(`${BASE}/workspaces/${ids.ws}/boards/${ids.board}/simulator/${ids.sprint}`)
    await pause(page, 3500)
    await page.mouse.wheel(0, 400)
    await pause(page, 2500)
  },
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true })
  const ids = await seededIds()
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const [name, scene] of Object.entries(SCENES)) {
      if (ONLY.length && !ONLY.includes(name)) continue
      const ctx = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        locale: 'ru-RU',
        colorScheme: 'light',
        recordVideo: { dir: RAW_DIR, size: VIEWPORT },
      })
      const page = await ctx.newPage()
      try {
        await scene(page, ctx, ids)
      }
      finally {
        const video = page.video()
        await ctx.close()
        if (video) renameSync(await video.path(), join(RAW_DIR, `${name}.webm`))
      }
      console.log(`recorded ${name}`)
    }
  }
  finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
