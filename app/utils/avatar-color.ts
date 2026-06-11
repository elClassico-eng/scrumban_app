export function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 55% 50%)`
}
