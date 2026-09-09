// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Discord snowflakes exceed JS Number.MAX_SAFE_INTEGER — keep as strings. */
export const DiscordClientIdSchema = z
  .string()
  .regex(/^\d{17,20}$/, 'Discord application ID must be a 17–20 digit snowflake')

export const DiscordBotTokenSchema = z.string().min(20, 'Discord bot token is too short')

export const AdminDiscordBotSettingsSchema = z.object({
  clientId: z.string(),
  tokenConfigured: z.boolean(),
  tokenHint: z.string().nullable(),
  source: z.enum(['database', 'env', 'none']),
})
export type AdminDiscordBotSettings = z.infer<typeof AdminDiscordBotSettingsSchema>

export const UpdateDiscordBotSettingsSchema = z.object({
  clientId: DiscordClientIdSchema,
  token: DiscordBotTokenSchema.optional(),
})
export type UpdateDiscordBotSettings = z.infer<typeof UpdateDiscordBotSettingsSchema>

/** Internal bot fetch — plaintext token. Never sent to browsers. */
export const InternalDiscordBotCredentialsSchema = z.object({
  clientId: DiscordClientIdSchema,
  token: DiscordBotTokenSchema,
})
export type InternalDiscordBotCredentials = z.infer<typeof InternalDiscordBotCredentialsSchema>

/** Bot self-reported liveness ping. Internal only — no secrets. */
export const DiscordBotHeartbeatSchema = z.object({
  guildCount: z.number().int().nonnegative(),
  uptimeSecs: z.number().int().nonnegative(),
  currentTrack: z.string().nullable().optional(),
})
export type DiscordBotHeartbeatInput = z.infer<typeof DiscordBotHeartbeatSchema>

export const DiscordBotHeartbeatAckSchema = z.object({ ok: z.literal(true) })

export const AdminDiscordBotRestartResponseSchema = z.object({
  ok: z.literal(true),
  action: z.literal('restart'),
  container: z.string(),
})
