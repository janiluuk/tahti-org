// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ANNOUNCEMENT_SCHEDULE_MODES = ['AFTER_EVERY', 'EVERY_NTH', 'RANDOM'] as const
export type AnnouncementScheduleModeInput = (typeof ANNOUNCEMENT_SCHEDULE_MODES)[number]

// Short pre-mixed clips — a single upload, no multi-bitrate transcode pipeline
// needed (Liquidsoap only ever needs one resolvable file per playlist row).
export const PrepareAnnouncementUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^audio\//, 'Must be an audio file'),
  fileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024),
  title: z.string().trim().min(1).max(120),
})
export type PrepareAnnouncementUploadInput = z.infer<typeof PrepareAnnouncementUploadSchema>

export const PrepareAnnouncementUploadResponseSchema = z.object({
  uploadId: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string(),
})

export const CompleteAnnouncementUploadSchema = z.object({
  uploadId: z.string(),
  title: z.string().trim().min(1).max(120),
  durationSec: z.number().int().min(0).max(600).optional(),
})
export type CompleteAnnouncementUploadInput = z.infer<typeof CompleteAnnouncementUploadSchema>

export const ANNOUNCEMENT_RENDER_STATUSES = ['READY', 'PROCESSING', 'ERROR'] as const
export type AnnouncementRenderStatusInput = (typeof ANNOUNCEMENT_RENDER_STATUSES)[number]

export const AnnouncementClipViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSec: z.number().int().nullable(),
  placement: z.enum(['BETWEEN', 'BEFORE', 'AFTER']).default('BETWEEN'),
  targetSoundId: z.string().nullable().optional(),
  draftStatus: z.enum(ANNOUNCEMENT_RENDER_STATUSES).nullable().optional(),
  isEnabled: z.boolean(),
  scheduleMode: z.enum(ANNOUNCEMENT_SCHEDULE_MODES),
  everyNth: z.number().int().nullable(),
  position: z.number().int(),
  renderStatus: z.enum(ANNOUNCEMENT_RENDER_STATUSES),
  createdAt: z.coerce.date(),
  /** True when this clip is the looping ambient music on the artist's public page. */
  isProfileBackground: z.boolean().optional(),
  /** Presigned preview link; only the board's system-clip list sets it. */
  audioUrl: z.string().optional(),
})

export const ProfileBackgroundClipSchema = z.object({
  clipId: z.string().nullable(),
})
export type ProfileBackgroundClipInput = z.infer<typeof ProfileBackgroundClipSchema>

export const ProfileBackgroundClipResponseSchema = z.object({
  clipId: z.string().nullable(),
})

export const AnnouncementClipListSchema = z.object({
  clips: z.array(AnnouncementClipViewSchema),
})

export const PatchAnnouncementClipSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    isEnabled: z.boolean().optional(),
    scheduleMode: z.enum(ANNOUNCEMENT_SCHEDULE_MODES).optional(),
    everyNth: z.number().int().min(2).max(100).nullable().optional(),
    position: z.number().int().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })
export type PatchAnnouncementClipInput = z.infer<typeof PatchAnnouncementClipSchema>

export const AnnouncementSettingsSchema = z.object({
  systemEnabled: z.boolean(),
})
export type AnnouncementSettingsInput = z.infer<typeof AnnouncementSettingsSchema>

// Trim editor — always renders from the untouched original upload, so re-edits
// never compound quality loss and the editor can A/B against the original.
export const AnnouncementEditorSourceSchema = z.object({
  editorSettings: z.unknown().optional(),
  draftSettings: z.unknown().optional(),
  draftUrl: z.string().url().nullable().optional(),
  draftStatus: z.enum(ANNOUNCEMENT_RENDER_STATUSES).nullable().optional(),
  renderToken: z.string().nullable().optional(),
  url: z.string().url(),
  originalUrl: z.string().url(),
  durationSec: z.number().int().nullable(),
  title: z.string(),
  renderStatus: z.enum(ANNOUNCEMENT_RENDER_STATUSES),
})

export const AnnouncementEditorRenderSchema = z
  .object({
    startSec: z.number().min(0),
    endSec: z.number().min(0),
    fadeInSec: z.number().min(0).max(30).default(0),
    fadeOutSec: z.number().min(0).max(30).default(0),
  })
  .refine((b) => b.endSec > b.startSec, { message: 'End must be after start' })
export type AnnouncementEditorRenderInput = z.infer<typeof AnnouncementEditorRenderSchema>

export const AnnouncementEditorRenderResponseSchema = z.object({
  ok: z.literal(true),
  renderStatus: z.enum(ANNOUNCEMENT_RENDER_STATUSES),
})

export const AnnouncementVoiceSettingsSchema = z
  .object({
    startSec: z.number().finite().min(0).max(600),
    endSec: z.number().finite().positive().max(600),
    fadeInSec: z.number().finite().min(0).max(30).default(0),
    fadeOutSec: z.number().finite().min(0).max(30).default(0),
    normalize: z.boolean().default(false),
    removeRumble: z.boolean().default(false),
    compress: z.boolean().default(false),
    deEss: z.boolean().default(false),
    warmth: z.boolean().default(false),
    clarity: z.boolean().default(false),
  })
  .refine((b) => b.endSec > b.startSec && b.fadeInSec + b.fadeOutSec <= b.endSec - b.startSec, {
    message: 'End must follow start and fades must fit inside the clip',
  })
export type AnnouncementVoiceSettings = z.infer<typeof AnnouncementVoiceSettingsSchema>

export const ApplyAnnouncementEditorSchema = z
  .object({
    renderToken: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    isEnabled: z.boolean(),
    scheduleMode: z.enum(['AFTER_EVERY', 'EVERY_NTH', 'RANDOM']),
    everyNth: z.number().int().min(2).max(100).nullable(),
    placement: z.enum(['BETWEEN', 'BEFORE', 'AFTER']),
    targetSoundId: z.string().min(1).nullable(),
  })
  .refine((b) => b.scheduleMode !== 'EVERY_NTH' || b.everyNth !== null, {
    message: 'Choose how many programs play between clips',
  })
  .refine((b) => b.placement === 'BETWEEN' || b.targetSoundId !== null, {
    message: 'Choose a program for this placement',
  })
