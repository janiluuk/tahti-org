// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'

export const MAX_CONCURRENT_EDITOR_JOBS = 2

export async function ownedItem(fastify: FastifyInstance, userId: string, itemId: string) {
  return fastify.prisma.sound.findFirst({
    where: { id: itemId, channel: { userId } },
    select: {
      id: true,
      title: true,
      durationSec: true,
      editList: true,
      tracklist: true,
      editorPeaks: true,
      updatedAt: true,
      channel: { select: { slug: true } },
    },
  })
}

export async function countActiveEditorJobs(
  fastify: FastifyInstance,
  userId: string,
): Promise<number> {
  return fastify.prisma.soundVersion.count({
    where: {
      status: { in: ['PENDING', 'PROCESSING'] },
      sound: { channel: { userId } },
    },
  })
}
