// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

/** Public object URL for RSS enclosures and stable links (CDN / MinIO gateway). */
export function publicMediaUrl(objectKey: string | null | undefined): string | null {
  if (!objectKey) return null
  const base = config.minio.publicEndpoint.replace(/\/$/, '')
  const key = objectKey.replace(/^\//, '')
  return `${base}/${config.minio.bucket}/${key}`
}
