// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

/** Reads the `key` query param of a shared-link request, if any. */
export function shareKeyFromQuery(query: unknown): string | null {
  const key = (query as { key?: unknown } | null)?.key
  return typeof key === 'string' && key.length > 0 && key.length <= 64 ? key : null
}

export type SoundSharePermission = 'READ' | 'DOWNLOAD'

/** True when `key` is an unexpired share link for this sound that the viewer
 * may use (links with a grantee only work for that signed-in member). A
 * DOWNLOAD link also grants READ; a READ link never grants DOWNLOAD. */
export async function soundShareGrantsAccess(
  prisma: PrismaClient,
  soundId: string,
  key: string | null,
  viewerUsername: string | null,
  permission: SoundSharePermission = 'READ',
): Promise<boolean> {
  if (!key) return false
  const share = await prisma.soundShare.findUnique({
    where: { token: key },
    select: { soundId: true, granteeUsername: true, expiresAt: true, permission: true },
  })
  if (!share || share.soundId !== soundId) return false
  if (permission === 'DOWNLOAD' && share.permission !== 'DOWNLOAD') return false
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) return false
  if (share.granteeUsername && share.granteeUsername !== viewerUsername) return false
  return true
}
