// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const StorageQuotaViewSchema = z.object({
  quotaBytes: z.number().nullable(),
  usedBytes: z.number(),
  /** Members see usage with no target/limit at all — not even the soft one. */
  unlimited: z.boolean().default(false),
})

export const AdminStorageUsageRowSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  quotaBytes: z.number(),
  usedBytes: z.number(),
  /** Paying members (docs/storage-policy.md: "no per-user storage limits" for
   * members) — mirrors /api/me/storage's own isMember-driven `unlimited` field.
   * The admin quota editor is still shown for these rows (a board override always
   * remains possible), but the row itself reads "Unlimited" instead of a percent. */
  unlimited: z.boolean(),
})

export const DiskSpaceSchema = z.object({
  totalBytes: z.number().nullable(),
  freeBytes: z.number().nullable(),
  usedBytes: z.number().nullable(),
  /** Human-readable caveat shown next to the figures — e.g. why there's no
   * total/free for a backend that doesn't have a fixed capacity. Null when the
   * figures need no caveat (e.g. a real statfs reading). */
  note: z.string().nullable(),
})

export const AdminStorageOverviewSchema = z.object({
  totalQuotaBytes: z.number(),
  totalUsedBytes: z.number(),
  userCount: z.number().int(),
  users: z.array(AdminStorageUsageRowSchema),
  /** The API host's local disk — also what MinIO's hot/streaming cache lives on. */
  localDisk: DiskSpaceSchema,
  /** Cloudflare R2 — the long-term, per-user-quota'd object storage backend
   * (see config.r2 / docs storage-policy.md). Billed by usage, not a fixed
   * volume, so totalBytes/freeBytes are null; usedBytes is real (the same
   * tracked total as totalUsedBytes above). */
  objectStorage: DiskSpaceSchema,
})

// Every file/item that counts against a user's quota (see
// lib/user-storage.ts#computeUserStorageUsedBytes): archive items (the public
// broadcast/track archive) and stash files (private uploads). `kind`
// disambiguates which table a row came from. Only archive items and
// audio-shaped stash files are playable — `isAudio` gates the Files UI's play
// button so non-audio uploads (zips, images) never get a fake one.
export const AdminUserFileSchema = z.object({
  id: z.string(),
  kind: z.enum(['archive', 'stash']),
  title: z.string(),
  sizeBytes: z.number().nullable(),
  createdAt: z.string().datetime(),
  contentType: z.string().nullable(),
  isPublic: z.boolean().nullable(),
  isAudio: z.boolean(),
  previewUrl: z.string().url().nullable(),
  /** Cumulative sizeBytes total up to and including this row, in the same
   * (oldest-first) order the array is returned in. */
  runningTotalBytes: z.number(),
})

export const AdminUserFilesResponseSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  tier: z.enum(['FREE', 'ARTIST', 'STUDIO']),
  quotaBytes: z.number().nullable(),
  usedBytes: z.number(),
  unlimited: z.boolean(),
  files: z.array(AdminUserFileSchema),
})

// Admin per-user quota override — min 1 byte (not 0, which would just block
// every future upload rather than express "no extra allowance"), max 1TB as
// a sanity ceiling against fat-fingering a value in bytes.
export const AdminSetUserQuotaSchema = z.object({
  quotaBytes: z
    .number()
    .int()
    .min(1)
    .max(1024 * 1024 * 1024 * 1024),
})

export type AdminSetUserQuota = z.infer<typeof AdminSetUserQuotaSchema>
