export function resolveContextBoard(input: {
  routeBoardId: string | null
  lastBoardId: string | null | undefined
  boards: { id: string }[]
}): string | null {
  if (input.routeBoardId && input.boards.some((b) => b.id === input.routeBoardId)) return input.routeBoardId
  if (input.lastBoardId && input.boards.some((b) => b.id === input.lastBoardId)) return input.lastBoardId
  return input.boards[0]?.id ?? null
}
