// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Module-level store for in-flight uploads. Lives in browser JS heap across
// Next.js route navigations within the same tab session.

export interface PendingUpload {
  uploadId: string
  file: File
  uploadUrl: string
  source?: 'UPLOAD' | 'MIXCLOUD_RESCUE'
}

const pending = new Map<string, PendingUpload>()

export function setPendingUpload(
  uploadId: string,
  file: File,
  uploadUrl: string,
  source?: 'UPLOAD' | 'MIXCLOUD_RESCUE',
): void {
  pending.set(uploadId, { uploadId, file, uploadUrl, source })
}

export function getPendingUpload(uploadId: string): PendingUpload | undefined {
  return pending.get(uploadId)
}

export function clearPendingUpload(uploadId: string): void {
  pending.delete(uploadId)
}
