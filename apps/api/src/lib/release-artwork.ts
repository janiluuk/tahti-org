// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { presignedGetUrl } from './minio.js'

const ARTWORK_PRESIGN_SEC = 3600

export async function resolveReleaseArtworkUrl(release: {
  artworkUrl: string | null
  artworkKey: string | null
}): Promise<string | null> {
  if (release.artworkKey) {
    return presignedGetUrl(release.artworkKey, ARTWORK_PRESIGN_SEC)
  }
  return release.artworkUrl
}
