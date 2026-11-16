import { z } from 'zod'
import { FEED_EVENTS } from '../types/integrations'
import { INSTANT_NOTIFICATION_TYPES } from '../types/notification'

const unique = <T>(a: T[]) => new Set(a).size === a.length

export const PachcaConnectSchema = z.object({
  token: z.string().trim().min(10).max(512).optional(),
  signingSecret: z.string().trim().min(8).max(512).nullable().optional(),
})

export const PachcaLinkSchema = z.object({
  pachcaUserId: z.string().regex(/^\d+$/),
})

export const PachcaMyLinkSchema = z.object({
  instantTypes: z.array(z.enum(INSTANT_NOTIFICATION_TYPES)).refine(unique).optional(),
  digest: z.boolean().optional(),
}).refine(d => d.instantTypes !== undefined || d.digest !== undefined)

const StandupTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()
const FeedEventsSchema = z.array(z.enum(FEED_EVENTS)).refine(unique)

export const CreateFeedSchema = z.object({
  chatId: z.string().regex(/^\d+$/),
  events: FeedEventsSchema,
  standupTime: StandupTimeSchema,
})

export const UpdateFeedSchema = z.object({
  events: FeedEventsSchema.optional(),
  standupTime: StandupTimeSchema.optional(),
}).refine(d => d.events !== undefined || d.standupTime !== undefined)
