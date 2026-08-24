// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const DISCO_WIDGET_SCOPES = ['LISTENER', 'ARTIST', 'ADMIN'] as const
export type DiscoWidgetScopeInput = (typeof DISCO_WIDGET_SCOPES)[number]

export const DISCO_WIDGET_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'DISABLED',
] as const
export type DiscoWidgetStatusInput = (typeof DISCO_WIDGET_STATUSES)[number]

// Curated suggestions for the store's filter chips — not DB-enforced, so a new
// category can ship in a widget's registration without a migration. Kept here
// only so the admin "register widget" form has something to suggest.
export const DISCO_WIDGET_SUGGESTED_CATEGORIES = [
  'new-releases',
  'stats',
  'social',
  'genre',
  'events',
  'other',
] as const

const CategorySchema = z.string().trim().min(1).max(32)

export const DiscoWidgetSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, 'Lowercase letters, numbers, and hyphens only')

export const DiscoWidgetVersionStringSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+$/, 'Must be a semver version, e.g. 1.0.0')

// ── Store browsing (public, scoped) ─────────────────────────────────────────

export const DiscoWidgetStoreItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  authorName: z.string(),
  categories: z.array(z.string()),
  iconUrl: z.string().nullable(),
  currentVersion: z.string(),
})
export type DiscoWidgetStoreItem = z.infer<typeof DiscoWidgetStoreItemSchema>

export const DiscoWidgetStoreListSchema = z.object({
  widgets: z.array(DiscoWidgetStoreItemSchema),
})

// Only LISTENER/ARTIST — the ADMIN scope's store lives behind requireBoard on
// GET /api/admin/disco-widgets, not this public-ish endpoint.
export const DiscoWidgetStoreQuerySchema = z.object({
  scope: z.enum(['LISTENER', 'ARTIST']),
  category: z.string().trim().min(1).max(32).optional(),
})
export type DiscoWidgetStoreQueryInput = z.infer<typeof DiscoWidgetStoreQuerySchema>

// ── Installs (per scope, owner-checked) ─────────────────────────────────────

export const CreateDiscoWidgetInstallSchema = z.object({
  widgetId: z.string().min(1),
})
export type CreateDiscoWidgetInstallInput = z.infer<typeof CreateDiscoWidgetInstallSchema>

export const CreateAdminDiscoWidgetInstallSchema = CreateDiscoWidgetInstallSchema.extend({
  surface: z.string().trim().min(1).max(40),
})
export type CreateAdminDiscoWidgetInstallInput = z.infer<typeof CreateAdminDiscoWidgetInstallSchema>

export const AdminDiscoWidgetInstallQuerySchema = z.object({
  surface: z.string().trim().min(1).max(40),
})

export const PatchDiscoWidgetInstallSchema = z
  .object({
    enabled: z.boolean().optional(),
    position: z.number().int().min(0).max(999).optional(),
    configJson: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })
export type PatchDiscoWidgetInstallInput = z.infer<typeof PatchDiscoWidgetInstallSchema>

export const DiscoWidgetInstallViewSchema = z.object({
  id: z.string(),
  widget: DiscoWidgetStoreItemSchema,
  position: z.number().int(),
  enabled: z.boolean(),
  configJson: z.unknown(),
  createdAt: z.coerce.date(),
})
export type DiscoWidgetInstallView = z.infer<typeof DiscoWidgetInstallViewSchema>

export const DiscoWidgetInstallListSchema = z.object({
  installs: z.array(DiscoWidgetInstallViewSchema),
})

// ── Public rendering feeds ───────────────────────────────────────────────────
// What a page fetches to render someone ELSE's installed widgets. Only
// already-public fields ever go into `context` — never anything gated by
// requireAuth, session tokens, or PII. The widget bundle only ever sees this.

export const ArtistWidgetContextSchema = z.object({
  channelSlug: z.string(),
  displayName: z.string(),
  isLive: z.boolean(),
})
export type ArtistWidgetContext = z.infer<typeof ArtistWidgetContextSchema>

export const ListenerWidgetContextSchema = z.object({})
export type ListenerWidgetContext = z.infer<typeof ListenerWidgetContextSchema>

export const AdminWidgetContextSchema = z.object({
  surface: z.string(),
})
export type AdminWidgetContext = z.infer<typeof AdminWidgetContextSchema>

export const DiscoWidgetRenderItemSchema = z.object({
  installId: z.string(),
  widgetSlug: z.string(),
  name: z.string(),
  sandboxUrl: z.string(),
  version: z.string(),
  position: z.number().int(),
  config: z.unknown(),
  context: z.unknown(),
})
export type DiscoWidgetRenderItem = z.infer<typeof DiscoWidgetRenderItemSchema>

export const DiscoWidgetRenderListSchema = z.object({
  widgets: z.array(DiscoWidgetRenderItemSchema),
})

// ── Admin catalog management ─────────────────────────────────────────────────

export const RegisterDiscoWidgetSchema = z.object({
  slug: DiscoWidgetSlugSchema,
  scope: z.enum(DISCO_WIDGET_SCOPES),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(400),
  authorName: z.string().trim().min(1).max(80),
  categories: z.array(CategorySchema).min(1).max(5),
  iconUrl: z.string().url().optional(),
})
export type RegisterDiscoWidgetInput = z.infer<typeof RegisterDiscoWidgetSchema>

// 2 MB — generous for a display widget, small enough that a review of the
// diff/size is still meaningful and hosting cost stays trivial.
export const DISCO_WIDGET_BUNDLE_MAX_BYTES = 2 * 1024 * 1024

export const PrepareDiscoWidgetUploadSchema = z.object({
  version: DiscoWidgetVersionStringSchema,
  fileSizeBytes: z.number().int().min(1).max(DISCO_WIDGET_BUNDLE_MAX_BYTES),
})
export type PrepareDiscoWidgetUploadInput = z.infer<typeof PrepareDiscoWidgetUploadSchema>

export const PrepareDiscoWidgetUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  bundleKey: z.string(),
  expiresAt: z.string(),
})

export const PublishDiscoWidgetVersionSchema = z.object({
  version: DiscoWidgetVersionStringSchema,
  changelog: z.string().trim().max(2000).optional(),
})
export type PublishDiscoWidgetVersionInput = z.infer<typeof PublishDiscoWidgetVersionSchema>

export const ModerateDiscoWidgetSchema = z.object({
  moderationNote: z.string().trim().max(2000).optional(),
})
export type ModerateDiscoWidgetInput = z.infer<typeof ModerateDiscoWidgetSchema>

export const RejectDiscoWidgetSchema = z.object({
  moderationNote: z.string().trim().min(1).max(2000),
})
export type RejectDiscoWidgetInput = z.infer<typeof RejectDiscoWidgetSchema>

export const DiscoWidgetAdminItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  scope: z.enum(DISCO_WIDGET_SCOPES),
  status: z.enum(DISCO_WIDGET_STATUSES),
  name: z.string(),
  description: z.string(),
  authorName: z.string(),
  categories: z.array(z.string()),
  iconUrl: z.string().nullable(),
  currentVersion: z.string(),
  bundleSizeBytes: z.number().int(),
  moderationNote: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type DiscoWidgetAdminItem = z.infer<typeof DiscoWidgetAdminItemSchema>

export const DiscoWidgetAdminListSchema = z.object({
  widgets: z.array(DiscoWidgetAdminItemSchema),
})

export const DiscoWidgetAdminListQuerySchema = z.object({
  scope: z.enum(DISCO_WIDGET_SCOPES).optional(),
  status: z.enum(DISCO_WIDGET_STATUSES).optional(),
})
export type DiscoWidgetAdminListQueryInput = z.infer<typeof DiscoWidgetAdminListQuerySchema>

export const DiscoWidgetIdParamSchema = z.object({
  id: z.string().min(1).max(64),
})

export const DiscoWidgetBundleHashParamSchema = z.object({
  bundleHash: z.string().regex(/^[0-9a-f]{64}$/, 'Must be a hex sha256 hash'),
})
