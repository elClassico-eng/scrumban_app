import { z } from 'zod'

const Name = z.string().trim().min(1).max(1000)
const ContentType = z.string().trim().min(3).max(127).regex(/^[\w.+-]+\/[\w.+-]+$/)
const Size = z.number().int().positive()
const Dim = z.number().int().positive().max(20000).optional()

export const StartUploadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('attachment'),
    taskId: z.uuid(),
    forComment: z.boolean().default(false),
    name: Name,
    contentType: ContentType,
    size: Size,
    thumbSize: Size.optional(),
    width: Dim,
    height: Dim,
  }),
  z.object({ kind: z.literal('workspace_logo'), name: Name, contentType: ContentType, size: Size, width: Dim, height: Dim }),
  z.object({ kind: z.literal('board_image'), boardId: z.uuid(), name: Name, contentType: ContentType, size: Size, width: Dim, height: Dim }),
])

export const StartAvatarUploadSchema = z.object({
  name: Name,
  contentType: ContentType,
  size: Size,
  width: Dim,
  height: Dim,
})

export const StartBackgroundUploadSchema = StartAvatarUploadSchema.extend({
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
})
