// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export interface TaggedMeta {
  title?: string
  artist?: string
  year?: number
  genre?: string
  coverDataUrl?: string
  durationSec?: number
  isLossless?: boolean
  codec?: string
  fromTag: Set<string>
}

interface ParsedAudioMetadata {
  common: {
    title?: string
    artist?: string
    year?: number
    genre?: string[]
    picture?: Array<{ data: unknown; format: string }>
  }
  format: {
    duration?: number
    lossless?: boolean
    codec?: string
  }
}

type ParseAudioBlob = (blob: Blob, options: { skipCovers: boolean }) => Promise<ParsedAudioMetadata>

interface ExtractTagsOptions {
  timeoutMs?: number
  parseBlob?: ParseAudioBlob
}

const METADATA_TIMEOUT_MS = 5_000

function emptyTags(): TaggedMeta {
  return { fromTag: new Set() }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Audio metadata extraction timed out')),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function extractUploadTags(
  file: File,
  options: ExtractTagsOptions = {},
): Promise<TaggedMeta> {
  try {
    const meta = await withTimeout(
      (async () => {
        const parseBlob =
          options.parseBlob ??
          ((await import('music-metadata')).parseBlob as unknown as ParseAudioBlob)
        return parseBlob(file, { skipCovers: false })
      })(),
      options.timeoutMs ?? METADATA_TIMEOUT_MS,
    )

    const fromTag = new Set<string>()
    const result: TaggedMeta = { fromTag }

    if (meta.common.title) {
      result.title = meta.common.title
      fromTag.add('title')
    }
    if (meta.common.artist) {
      result.artist = meta.common.artist
      fromTag.add('artist')
    }
    if (meta.common.year) {
      result.year = meta.common.year
      fromTag.add('year')
    }
    if (meta.common.genre?.[0]) {
      result.genre = meta.common.genre[0]
      fromTag.add('genre')
    }
    if (meta.format.duration) result.durationSec = Math.round(meta.format.duration)
    if (meta.format.lossless !== undefined) result.isLossless = meta.format.lossless
    if (meta.format.codec) result.codec = meta.format.codec

    const picture = meta.common.picture?.[0]
    if (picture) {
      const blob = new Blob([picture.data as BlobPart], { type: picture.format })
      const image = await createImageBitmap(blob, { resizeWidth: 200, resizeHeight: 200 })
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      canvas.getContext('2d')!.drawImage(image, 0, 0)
      image.close()
      result.coverDataUrl = canvas.toDataURL('image/jpeg', 0.85)
    }

    return result
  } catch {
    return emptyTags()
  }
}
