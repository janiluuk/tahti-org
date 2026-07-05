// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRouter } from 'next/navigation'
import { CoverImageUpload } from '@/components/cover-image-upload'
import {
  completeReleaseArtworkUpload,
  fetchReleaseArtworkFromUrl,
  prepareReleaseArtworkUpload,
} from './release-actions'

export function ReleaseArtworkUpload({
  releaseId,
  artworkUrl,
}: {
  releaseId: string
  artworkUrl: string | null | undefined
}) {
  const router = useRouter()

  return (
    <CoverImageUpload
      currentUrl={artworkUrl}
      label="Cover art"
      prepare={(args) => prepareReleaseArtworkUpload(releaseId, args)}
      complete={async (uploadKey) => {
        const res = await completeReleaseArtworkUpload(releaseId, uploadKey)
        return { url: res.artworkUrl ?? null, error: res.error }
      }}
      fromUrl={async (sourceUrl) => {
        const res = await fetchReleaseArtworkFromUrl(releaseId, sourceUrl)
        return { url: res.artworkUrl ?? null, error: res.error }
      }}
      onUploaded={() => router.refresh()}
    />
  )
}
