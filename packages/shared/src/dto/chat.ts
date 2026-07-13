// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CHAT_REACTION_EMOJIS = ['💜', '🔥', '🎶', '🎵', '🌟', '👏', '✨'] as const

export const ChatReactSchema = z.object({
  emoji: z.enum(CHAT_REACTION_EMOJIS, { message: 'Invalid emoji' }),
})

export type ChatReactInput = z.infer<typeof ChatReactSchema>

export const ChatAnnouncementSchema = z.object({
  body: z.string().trim().min(1, 'body is required').max(500),
})

export type ChatAnnouncementInput = z.infer<typeof ChatAnnouncementSchema>

export const ChatBanSchema = z.object({
  fingerprintHash: z
    .string()
    .trim()
    .min(8, 'fingerprintHash is required')
    .max(128)
    .regex(/^[a-f0-9]+$/i, 'fingerprintHash must be hex'),
})

export type ChatBanInput = z.infer<typeof ChatBanSchema>

export const AddModeratorSchema = z.object({
  username: z.string().trim().min(1, 'username is required').max(32),
})

export type AddModeratorInput = z.infer<typeof AddModeratorSchema>

export const ChatTokenSchema = z.object({
  handle: z.string().trim().min(1, 'handle is required').max(32),
  hcaptchaToken: z.string().optional(),
})

export type ChatTokenInput = z.infer<typeof ChatTokenSchema>

export const ChatSettingsPatchSchema = z.object({
  subscribersOnly: z.boolean(),
})

export type ChatSettingsPatchInput = z.infer<typeof ChatSettingsPatchSchema>

export const ChatSettingsResponseSchema = z.object({
  subscribersOnly: z.boolean(),
})
