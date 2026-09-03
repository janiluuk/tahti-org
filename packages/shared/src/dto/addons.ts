// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ADDON_SCOPES = ['LISTENER', 'ARTIST', 'ADMIN'] as const
export type AddonScopeInput = (typeof ADDON_SCOPES)[number]

export const ADDON_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'] as const
export type AddonStatusInput = (typeof ADDON_STATUSES)[number]

// Curated suggestions for the store's filter chips — not DB-enforced, so a new
// category can ship in a widget's registration without a migration. Kept here
// only so the admin "register widget" form has something to suggest.
export const ADDON_SUGGESTED_CATEGORIES = [
  'new-releases',
  'stats',
  'social',
  'genre',
  'events',
  'other',
] as const

const CategorySchema = z.string().trim().min(1).max(32)

export const AddonSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, 'Lowercase letters, numbers, and hyphens only')

export const AddonVersionStringSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+$/, 'Must be a semver version, e.g. 1.0.0')

// ── Store browsing (public, scoped) ─────────────────────────────────────────

export const AddonStoreItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  authorName: z.string(),
  categories: z.array(z.string()),
  iconUrl: z.string().nullable(),
  currentVersion: z.string(),
})
export type AddonStoreItem = z.infer<typeof AddonStoreItemSchema>

export const AddonStoreListSchema = z.object({
  widgets: z.array(AddonStoreItemSchema),
})

// Only LISTENER/ARTIST — the ADMIN scope's store lives behind requireBoard on
// GET /api/admin/addons, not this public-ish endpoint.
export const AddonStoreQuerySchema = z.object({
  scope: z.enum(['LISTENER', 'ARTIST']),
  category: z.string().trim().min(1).max(32).optional(),
})
export type AddonStoreQueryInput = z.infer<typeof AddonStoreQuerySchema>

// ── Installs (per scope, owner-checked) ─────────────────────────────────────

export const CreateAddonInstallSchema = z.object({
  widgetId: z.string().min(1),
})
export type CreateAddonInstallInput = z.infer<typeof CreateAddonInstallSchema>

export const CreateAdminAddonInstallSchema = CreateAddonInstallSchema.extend({
  surface: z.string().trim().min(1).max(40),
})
export type CreateAdminAddonInstallInput = z.infer<typeof CreateAdminAddonInstallSchema>

export const AdminAddonInstallQuerySchema = z.object({
  surface: z.string().trim().min(1).max(40),
})

export const PatchAddonInstallSchema = z
  .object({
    enabled: z.boolean().optional(),
    position: z.number().int().min(0).max(999).optional(),
    configJson: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })
export type PatchAddonInstallInput = z.infer<typeof PatchAddonInstallSchema>

export const AddonInstallViewSchema = z.object({
  id: z.string(),
  widget: AddonStoreItemSchema,
  position: z.number().int(),
  enabled: z.boolean(),
  configJson: z.unknown(),
  createdAt: z.coerce.date(),
})
export type AddonInstallView = z.infer<typeof AddonInstallViewSchema>

export const AddonInstallListSchema = z.object({
  installs: z.array(AddonInstallViewSchema),
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

export const AddonRenderItemSchema = z.object({
  installId: z.string(),
  widgetSlug: z.string(),
  name: z.string(),
  sandboxUrl: z.string(),
  version: z.string(),
  position: z.number().int(),
  config: z.unknown(),
  context: z.unknown(),
})
export type AddonRenderItem = z.infer<typeof AddonRenderItemSchema>

export const AddonRenderListSchema = z.object({
  widgets: z.array(AddonRenderItemSchema),
})

// ── Admin catalog management ─────────────────────────────────────────────────

export const RegisterAddonSchema = z.object({
  slug: AddonSlugSchema,
  scope: z.enum(ADDON_SCOPES),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(400),
  authorName: z.string().trim().min(1).max(80),
  categories: z.array(CategorySchema).min(1).max(5),
  iconUrl: z.string().url().optional(),
})
export type RegisterAddonInput = z.infer<typeof RegisterAddonSchema>

// 2 MB — generous for a display widget, small enough that a review of the
// diff/size is still meaningful and hosting cost stays trivial.
export const ADDON_BUNDLE_MAX_BYTES = 2 * 1024 * 1024

export const PrepareAddonUploadSchema = z.object({
  version: AddonVersionStringSchema,
  fileSizeBytes: z.number().int().min(1).max(ADDON_BUNDLE_MAX_BYTES),
})
export type PrepareAddonUploadInput = z.infer<typeof PrepareAddonUploadSchema>

export const PrepareAddonUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  bundleKey: z.string(),
  expiresAt: z.string(),
})

export const PublishAddonVersionSchema = z.object({
  version: AddonVersionStringSchema,
  changelog: z.string().trim().max(2000).optional(),
})
export type PublishAddonVersionInput = z.infer<typeof PublishAddonVersionSchema>

export const ModerateAddonSchema = z.object({
  moderationNote: z.string().trim().max(2000).optional(),
})
export type ModerateAddonInput = z.infer<typeof ModerateAddonSchema>

export const RejectAddonSchema = z.object({
  moderationNote: z.string().trim().min(1).max(2000),
})
export type RejectAddonInput = z.infer<typeof RejectAddonSchema>

// Board-only: sets/clears the starting configJson every new install of this
// widget gets, across all scopes — copied from one install's current
// configJson by the "Save as default" action, or cleared with null.
export const SetAddonDefaultConfigSchema = z.object({
  defaultConfigJson: z.record(z.string(), z.unknown()).nullable(),
})
export type SetAddonDefaultConfigInput = z.infer<typeof SetAddonDefaultConfigSchema>

export const AddonAdminItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  scope: z.enum(ADDON_SCOPES),
  status: z.enum(ADDON_STATUSES),
  name: z.string(),
  description: z.string(),
  authorName: z.string(),
  categories: z.array(z.string()),
  iconUrl: z.string().nullable(),
  currentVersion: z.string(),
  bundleSizeBytes: z.number().int(),
  moderationNote: z.string().nullable(),
  defaultConfigJson: z.unknown().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type AddonAdminItem = z.infer<typeof AddonAdminItemSchema>

export const AddonAdminListSchema = z.object({
  widgets: z.array(AddonAdminItemSchema),
})

export const AddonAdminListQuerySchema = z.object({
  scope: z.enum(ADDON_SCOPES).optional(),
  status: z.enum(ADDON_STATUSES).optional(),
})
export type AddonAdminListQueryInput = z.infer<typeof AddonAdminListQuerySchema>

export const AddonIdParamSchema = z.object({
  id: z.string().min(1).max(64),
})

export const AddonBundleHashParamSchema = z.object({
  bundleHash: z.string().regex(/^[0-9a-f]{64}$/, 'Must be a hex sha256 hash'),
})
