export function holdProgress(heldMs: number, durationMs: number): number {
  return Math.min(1, Math.max(0, heldMs / durationMs))
}
