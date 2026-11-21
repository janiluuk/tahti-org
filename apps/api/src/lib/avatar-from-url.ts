// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { nanoid } from 'nanoid'
import { extFromMime, fetchImageFromUrl } from './fetch-image-url.js'
import { putObjectBuffer } from './minio.js'
import { publicMediaUrl } from './public-media-url.js'
import { extractPalette } from './palette-extract.js'

type AvatarPrisma = Pick<PrismaClient, 'user'>
type WarnLog = { warn: (err: unknown, msg: string) => void }

/** Fire-and-forget: extract a palette from the new avatar and persist it. */
export function refreshAvatarPalette(
  prisma: AvatarPrisma,
  userId: string,
  imageUrl: string,
  log: WarnLog,
) {
  extractPalette(imageUrl)
    .then((palette) => {
      if (!palette) return
      return prisma.user.update({
        where: { id: userId },
        data: { avatarPaletteJson: JSON.stringify(palette) },
      })
    })
    .catch((err) => log.warn(err, 'avatar palette extract failed'))
}

export type AvatarFromUrlResult =
  { ok: true; avatarUrl: string } | { ok: false; status: 422 | 500; error: string }

/** SSRF-guarded fetch of a remote image, stored as the user's avatar. */
export async function setAvatarFromUrl(
  prisma: AvatarPrisma,
  user: { id: string; username: string },
  sourceUrl: string,
  log: WarnLog,
): Promise<AvatarFromUrlResult> {
  const fetched = await fetchImageFromUrl(sourceUrl)
  if (!fetched.ok) return { ok: false, status: 422, error: fetched.error }

  const uploadKey = `avatars/${user.username}/avatar-${nanoid(8)}.${extFromMime(fetched.contentType)}`
  await putObjectBuffer(uploadKey, fetched.bytes, fetched.contentType)

  const avatarUrl = publicMediaUrl(uploadKey)
  if (!avatarUrl) return { ok: false, status: 500, error: 'Failed to resolve avatar URL' }
  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl, avatarPosterUrl: null },
  })

  refreshAvatarPalette(prisma, user.id, avatarUrl, log)
  return { ok: true, avatarUrl }
}
