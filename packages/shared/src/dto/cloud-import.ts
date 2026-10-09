// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const GoogleDriveConnectStatusSchema = z.object({
  connected: z.boolean(),
  configured: z.boolean(),
})

/**
 * `{ connected, configured }` body shared by the OAuth import providers'
 * status and disconnect routes (the `statusPath` in `GET /api/me/import-plugins`).
 * `configured` is false when the server has no client id + secret for the
 * provider, so the connect button can never work.
 */
export const ImportOAuthConnectStatusSchema = z.object({
  connected: z.boolean(),
  configured: z.boolean(),
})

/** MusicBrainz status also names the connected editor; disconnect omits it. */
export const MusicbrainzConnectStatusSchema = ImportOAuthConnectStatusSchema.extend({
  username: z.string().nullable().optional(),
})

/**
 * Machine-readable `code` on a provider route's error body, so a client can
 * tell "connect first" and "connect again" apart from an empty result.
 */
export const PROVIDER_NOT_CONNECTED = 'PROVIDER_NOT_CONNECTED'
export const PROVIDER_TOKEN_EXPIRED = 'PROVIDER_TOKEN_EXPIRED'

export const GoogleDrivePickerConfigSchema = z.object({
  clientId: z.string(),
  developerKey: z.string(),
  accessToken: z.string(),
})

export const GoogleDriveImportFileSchema = z.object({
  fileId: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().optional(),
})

export const GoogleDriveImportRequestSchema = z.object({
  files: z.array(GoogleDriveImportFileSchema).min(1).max(20),
})

export const GoogleDriveImportQueuedItemSchema = z.object({
  cloudImportJobId: z.string(),
  title: z.string(),
  status: z.literal('queued'),
})

export const GoogleDriveImportResponseSchema = z.object({
  imports: z.array(GoogleDriveImportQueuedItemSchema),
})

export const SoundcloudTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationMs: z.number(),
  artworkUrl: z.string().nullable(),
  downloadable: z.boolean(),
  createdAt: z.string(),
})

export const SoundcloudTrackListSchema = z.object({
  tracks: z.array(SoundcloudTrackSchema),
})

export const SoundcloudImportTrackSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1),
})

export const SoundcloudImportRequestSchema = z.object({
  tracks: z.array(SoundcloudImportTrackSchema).min(1).max(20),
})

export const SoundcloudImportQueuedItemSchema = z.object({
  cloudImportJobId: z.string(),
  status: z.literal('queued'),
})

export const SoundcloudImportResponseSchema = z.object({
  imports: z.array(SoundcloudImportQueuedItemSchema),
})

export const CloudImportJobStatusSchema = z.object({
  id: z.string(),
  source: z.string(),
  fileName: z.string().nullable(),
  status: z.string(),
  error: z.string().nullable(),
  soundId: z.string().nullable(),
  bytesTransferred: z.coerce.number().nullable(),
  queuedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
})

export const CloudImportJobListSchema = z.object({
  jobs: z.array(CloudImportJobStatusSchema),
})
