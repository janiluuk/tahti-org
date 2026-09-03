// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { prisma } from '@tahti/db'
import { deleteObject } from '../lib/minio.js'

const STEM_KEY_FIELDS = ['vocalsKey', 'instrumentalKey', 'drumsKey', 'bassKey', 'otherKey'] as const

export async function processSweepExpiredStemsJob(): Promise<{ deleted: number }> {
  const expired = await prisma.soundStemJob.findMany({
    where: { status: 'READY', expiresAt: { lte: new Date() } },
  })

  for (const job of expired) {
    for (const field of STEM_KEY_FIELDS) {
      const key = job[field]
      if (key) await deleteObject(key).catch(() => {})
    }
  }

  if (expired.length > 0) {
    await prisma.soundStemJob.deleteMany({
      where: { id: { in: expired.map((j) => j.id) } },
    })
  }

  return { deleted: expired.length }
}
