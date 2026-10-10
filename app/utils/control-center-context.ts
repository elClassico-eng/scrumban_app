export function resolveContextBoard(input: {
  routeBoardId: string | null
  overrideBoardId?: string | null
  lastBoardId: string | null | undefined
  boards: { id: string }[]
}): string | null {
  const has = (id: string | null | undefined) => !!id && input.boards.some((b) => b.id === id)
  if (has(input.overrideBoardId)) return input.overrideBoardId!
  if (has(input.routeBoardId)) return input.routeBoardId!
  if (has(input.lastBoardId)) return input.lastBoardId!
  return input.boards[0]?.id ?? null
}
