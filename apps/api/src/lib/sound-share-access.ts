// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

import { auditLog } from './audit.js'

/** Reads the `key` query param of a shared-link request, if any. */
export function shareKeyFromQuery(query: unknown): string | null {
  const key = (query as { key?: unknown } | null)?.key
  return typeof key === 'string' && key.length > 0 && key.length <= 64 ? key : null
}

export type SoundSharePermission = 'READ' | 'DOWNLOAD'

type ShareRow = {
  id: string
  soundId: string
  granteeUsername: string | null
  expiresAt: Date | null
  permission: string
  ownerId: string
}

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
  const share = await resolveSoundShare(prisma, soundId, key, viewerUsername, permission)
  return share !== null
}

export async function resolveSoundShare(
  prisma: PrismaClient,
  soundId: string,
  key: string | null,
  viewerUsername: string | null,
  permission: SoundSharePermission = 'READ',
): Promise<ShareRow | null> {
  if (!key) return null
  const share = await prisma.soundShare.findUnique({
    where: { token: key },
    select: {
      id: true,
      soundId: true,
      granteeUsername: true,
      expiresAt: true,
      permission: true,
      sound: { select: { userId: true } },
    },
  })
  if (!share || share.soundId !== soundId) return null
  if (permission === 'DOWNLOAD' && share.permission !== 'DOWNLOAD') return null
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) return null
  if (share.granteeUsername && share.granteeUsername !== viewerUsername) return null
  return {
    id: share.id,
    soundId: share.soundId,
    granteeUsername: share.granteeUsername,
    expiresAt: share.expiresAt,
    permission: share.permission,
    ownerId: share.sound.userId,
  }
}

/** Audit successful keyed access. Not a public feed event — board audit only. */
export async function recordSoundShareAccess(
  prisma: PrismaClient,
  params: {
    shareId: string
    soundId: string
    ownerId: string
    actorId: string | null
    surface: 'track' | 'download' | 'comments'
    permission: SoundSharePermission
  },
): Promise<void> {
  await auditLog(prisma, {
    action: 'SOUND_SHARE_ACCESS',
    // Anonymous viewers have no session — attribute to the sound owner with
    // meta.anonymous so the primary operation still leaves an audit trail.
    actorId: params.actorId ?? params.ownerId,
    targetId: params.soundId,
    meta: {
      shareId: params.shareId,
      surface: params.surface,
      permission: params.permission,
      anonymous: !params.actorId,
    },
  })
}
