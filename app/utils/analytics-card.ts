// UCard ships a ring and a divider. A page made of many such cards reads as a
// grid of boxes, so analytics cards drop the outline and take depth from the
// shared soft-shadow surface instead.
export const ANALYTICS_CARD_UI = {
  root: 'surface-soft rounded-2xl ring-0 shadow-none divide-y-0',
} as const
