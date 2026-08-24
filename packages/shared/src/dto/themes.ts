// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

// "Public" isn't a DB state — once a PR merges, a theme lives only in
// themes/registry.json + themes/<slug>.json in the tahti-org repo (see
// GET /api/v1/themes/gallery). This tracks the pre-ship pipeline only.
export const THEME_VISIBILITIES = ['PRIVATE', 'PENDING_REVIEW', 'REJECTED'] as const
export type ThemeVisibilityInput = (typeof THEME_VISIBILITIES)[number]

export const THEME_PR_STATUSES = ['NONE', 'PENDING', 'OPENED', 'ERROR'] as const
export type ThemePrStatusInput = (typeof THEME_PR_STATUSES)[number]

// Free-form: the editor lets a user add/remove arbitrary CSS-variable keys,
// same as the original tool this was ported from.
export const ThemeVarsMapSchema = z.record(z.string(), z.string())

export const CreateThemeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  vars: ThemeVarsMapSchema,
  dark: ThemeVarsMapSchema,
})
export type CreateThemeInput = z.infer<typeof CreateThemeSchema>

export const PatchThemeSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    vars: ThemeVarsMapSchema.optional(),
    dark: ThemeVarsMapSchema.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })
export type PatchThemeInput = z.infer<typeof PatchThemeSchema>

export const ThemeViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  vars: z.record(z.string(), z.string()),
  dark: z.record(z.string(), z.string()),
  visibility: z.enum(THEME_VISIBILITIES),
  moderationNote: z.string().nullable(),
  prStatus: z.enum(THEME_PR_STATUSES),
  prUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type ThemeView = z.infer<typeof ThemeViewSchema>

export const ThemeListSchema = z.object({
  themes: z.array(ThemeViewSchema),
})

export const AdminThemeViewSchema = ThemeViewSchema.extend({
  authorUsername: z.string(),
})
export type AdminThemeView = z.infer<typeof AdminThemeViewSchema>

export const AdminThemeListSchema = z.object({
  themes: z.array(AdminThemeViewSchema),
})

export const RejectThemeSchema = z.object({
  moderationNote: z.string().trim().min(1).max(2000),
})
export type RejectThemeInput = z.infer<typeof RejectThemeSchema>

export const AdminThemeListQuerySchema = z.object({
  visibility: z.enum(THEME_VISIBILITIES).optional(),
})

// ── Public gallery (registry-file backed, not the DB) ───────────────────────

export const ThemeGalleryEntrySchema = z.object({
  name: z.string(),
  file: z.string(),
  author: z.string().optional(),
})
export const ThemeGalleryResponseSchema = z.object({
  themes: z.array(ThemeGalleryEntrySchema),
})

// ── Admin test notification ─────────────────────────────────────────────────

export const SendTestNotificationSchema = z.object({
  targetUsername: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(500).optional(),
  url: z.string().trim().max(300).optional(),
})
export type SendTestNotificationInput = z.infer<typeof SendTestNotificationSchema>

export const SendTestNotificationResponseSchema = z.object({ ok: z.literal(true) })
