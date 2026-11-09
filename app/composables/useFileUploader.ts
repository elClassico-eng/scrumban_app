import { apiRoutes } from '~/routing'
import type { FileView, UploadTicket } from '#shared/types/files'

export type UploadTarget =
  | { kind: 'attachment', workspaceId: string, taskId: string, forComment?: boolean }
  | { kind: 'workspace_logo', workspaceId: string }
  | { kind: 'board_image', workspaceId: string, boardId: string }
  | { kind: 'user_avatar' }
  | { kind: 'user_background' }

export type UploadItem = {
  id: string
  name: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  error: string | null
  file: FileView | null
}

const MAX_PARALLEL = 3
const THUMB_SIDE = 480

function put(url: string, body: Blob, contentType: string, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Хранилище ответило ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('Сеть недоступна'))
    xhr.send(body)
  })
}

export function useFileUploader() {
  const items = ref<UploadItem[]>([])
  let active = 0
  const waiting: (() => void)[] = []

  async function slot(): Promise<() => void> {
    if (active >= MAX_PARALLEL) await new Promise<void>(resolve => waiting.push(resolve))
    active++
    return () => {
      active--
      waiting.shift()?.()
    }
  }

  function patch(id: string, next: Partial<UploadItem>) {
    items.value = items.value.map(i => (i.id === id ? { ...i, ...next } : i))
  }

  async function upload(file: File, target: UploadTarget): Promise<FileView | null> {
    const id = crypto.randomUUID()
    items.value = [...items.value, { id, name: file.name, progress: 0, status: 'uploading', error: null, file: null }]
    const release = await slot()
    try {
      const plan = uploadImagePlan(target.kind)
      const isFace = plan !== null
      const face = plan ? await resizeImage(file, plan) : null
      const thumb = !isFace && isPreviewableImage(file.type)
        ? await resizeImage(file, { maxSide: THUMB_SIDE, square: false }).catch(() => null)
        : null
      const body = face?.blob ?? file
      const contentType = face ? 'image/webp' : file.type || 'application/octet-stream'
      const meta = {
        name: file.name,
        contentType,
        size: body.size,
        width: face?.width ?? thumb?.width,
        height: face?.height ?? thumb?.height,
      }
      const base = 'workspaceId' in target
        ? apiRoutes.files(target.workspaceId)
        : target.kind === 'user_avatar' ? apiRoutes.avatar : apiRoutes.background
      const ticket = !('workspaceId' in target)
        ? await $fetch<UploadTicket>(base, { method: 'POST', body: meta })
        : await $fetch<UploadTicket>(base, {
            method: 'POST',
            body: {
              ...meta,
              kind: target.kind,
              ...(target.kind === 'attachment' ? { taskId: target.taskId, forComment: !!target.forComment, thumbSize: thumb?.blob.size } : {}),
              ...(target.kind === 'board_image' ? { boardId: target.boardId } : {}),
            },
          })
      await put(ticket.uploadUrl, body, contentType, p => patch(id, { progress: p }))
      if (ticket.thumbUploadUrl && thumb) await put(ticket.thumbUploadUrl, thumb.blob, 'image/webp', () => {})
      const completeUrl = `${base}/${ticket.file.id}/complete`
      const done = await $fetch<{ file: FileView }>(completeUrl, { method: 'POST' })
      patch(id, { status: 'done', progress: 1, file: done.file })
      return done.file
    }
    catch (err) {
      patch(id, { status: 'error', error: getErrorMessage(err, 'Не удалось загрузить файл') })
      return null
    }
    finally {
      release()
    }
  }

  function dismiss(id: string) {
    items.value = items.value.filter(i => i.id !== id)
  }

  return { items, upload, dismiss }
}
