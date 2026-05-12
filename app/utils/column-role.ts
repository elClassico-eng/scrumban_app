import type { ColumnRole } from '#shared/types/column'

interface ColumnRoleInfo {
  label: string
  hint: string
  chipClass: string
  bodyClass: string
  dotClass: string
}

export const COLUMN_ROLE_INFO: Record<ColumnRole, ColumnRoleInfo> = {
  backlog: {
    label: 'Backlog — очередь задач',
    hint: 'Пул задач до старта работы. Не считается в WIP, не входит в Lead Time.',
    chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    bodyClass: 'bg-slate-50/40 dark:bg-slate-900/20',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
  },
  in_progress: {
    label: 'В работе — активный поток',
    hint: 'Задачи в активной разработке. Входит в WIP, начинает Cycle Time.',
    chipClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
    bodyClass: 'bg-sky-50/40 dark:bg-sky-950/20',
    dotClass: 'bg-sky-500',
  },
  review: {
    label: 'На ревью — проверка/QA',
    hint: 'Задачи на ревью или тестировании. Считается в WIP и Cycle Time.',
    chipClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
    bodyClass: 'bg-violet-50/40 dark:bg-violet-950/20',
    dotClass: 'bg-violet-500',
  },
  done: {
    label: 'Готово — завершено',
    hint: 'Конец цикла. Аналитика берёт сюда время финиша задачи.',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    bodyClass: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    dotClass: 'bg-emerald-500',
  },
  archived: {
    label: 'Архив — вне потока',
    hint: 'Отменённые или отложенные задачи. Не учитываются в потоке.',
    chipClass: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    bodyClass: 'bg-zinc-50/40 dark:bg-zinc-950/20',
    dotClass: 'bg-zinc-400 dark:bg-zinc-500',
  },
}

export const COLUMN_ROLE_OPTIONS: Array<{ label: string; value: ColumnRole }> = (
  Object.entries(COLUMN_ROLE_INFO) as Array<[ColumnRole, ColumnRoleInfo]>
).map(([value, info]) => ({ label: info.label, value }))