// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { getUserIntegrationCredential } from '@tahti/db'
import { enqueueHearthisExport } from './queue.js'

export type HearthisExportSubmitResult =
  | { ok: true; soundId: string; hearthisExportStatus: 'pending' }
  | { ok: false; status: 400 | 404 | 409; error: string }

/**
 * Queue a sound-scoped hearthis.at export. Shared by the canonical route
 * `POST /api/me/sound/:id/export/hearthis` and the ExportProvider alias
 * `POST /api/me/export-plugins/hearthis-export/sounds/:id/submit`.
 */
export async function submitHearthisSoundExport(
  prisma: PrismaClient,
  userId: string,
  soundId: string,
): Promise<HearthisExportSubmitResult> {
  const credential = await getUserIntegrationCredential(prisma, userId, 'hearthis-export')
  if (!credential) {
    return { ok: false, status: 400, error: 'Install the hearthis.at export plugin first' }
  }

  const item = await prisma.sound.findFirst({
    where: { id: soundId, channel: { userId } },
    select: { id: true, hearthisExportStatus: true, rawKey: true, mp3Key: true, flacKey: true },
  })
  if (!item) return { ok: false, status: 404, error: 'Sound item not found' }
  if (!item.rawKey && !item.mp3Key && !item.flacKey) {
    return { ok: false, status: 400, error: 'This track has no audio file to export' }
  }
  if (item.hearthisExportStatus === 'pending' || item.hearthisExportStatus === 'submitted') {
    return { ok: false, status: 409, error: 'Export already in progress' }
  }

  await prisma.sound.update({
    where: { id: item.id },
    data: { hearthisExportStatus: 'pending' },
  })
  await enqueueHearthisExport(item.id)

  return { ok: true, soundId: item.id, hearthisExportStatus: 'pending' }
}
