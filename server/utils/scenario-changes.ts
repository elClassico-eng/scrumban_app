import { z } from 'zod'

export const ScenarioChangeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('exclude_task'), taskId: z.uuid() }),
  z.object({
    type: z.literal('reestimate_task'),
    taskId: z.uuid(),
    estimateDays: z.number().positive().max(365),
  }),
  z.object({
    type: z.literal('remove_dependency'),
    blockerTaskId: z.uuid(),
    blockedTaskId: z.uuid(),
  }),
  z.object({
    type: z.literal('add_dependency'),
    blockerTaskId: z.uuid(),
    blockedTaskId: z.uuid(),
  }),
  z.object({
    type: z.literal('shift_deadline'),
    days: z.number().int().min(-90).max(90).refine(d => d !== 0, 'Сдвиг не может быть нулевым'),
  }),
])

export const ScenarioChangesSchema = z
  .array(ScenarioChangeSchema)
  .min(1, 'Сценарий должен содержать хотя бы одно изменение')
  .max(50)
  .superRefine((changes, ctx) => {
    let deadlineCount = 0
    const taskIds = new Set<string>()
    const edgeKeys = new Set<string>()
    for (const c of changes) {
      if (c.type === 'shift_deadline') {
        deadlineCount += 1
        if (deadlineCount > 1) {
          ctx.addIssue({ code: 'custom', message: 'Не более одного сдвига дедлайна' })
        }
      }
      else if (c.type === 'exclude_task' || c.type === 'reestimate_task') {
        if (taskIds.has(c.taskId)) {
          ctx.addIssue({ code: 'custom', message: 'Не более одного изменения на задачу' })
        }
        taskIds.add(c.taskId)
      }
      else {
        if (c.blockerTaskId === c.blockedTaskId) {
          ctx.addIssue({ code: 'custom', message: 'Задача не может блокировать саму себя' })
        }
        const key = `${c.blockerTaskId}->${c.blockedTaskId}`
        if (edgeKeys.has(key)) {
          ctx.addIssue({ code: 'custom', message: 'Не более одного изменения на пару задач' })
        }
        edgeKeys.add(key)
      }
    }
  })
