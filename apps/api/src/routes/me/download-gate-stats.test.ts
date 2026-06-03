// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'gate-summary-'

describe('M22 — download gate summary', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string
  let gatedItemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'gate-summary-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98621,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelId = artist.channel!.id

    const gated = await createReadyArchiveItem(prisma, channelId, 'Gated mix')
    gatedItemId = gated.id
    await prisma.archiveItem.update({
      where: { id: gatedItemId },
      data: { repostToDownload: true },
    })
    await createReadyArchiveItem(prisma, channelId, 'Open mix')

    await prisma.archiveRepostAck.create({
      data: {
        archiveItemId: gatedItemId,
        byFingerprint: 'fp-gate-summary',
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/me/download-gate-stats returns per-item funnel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/download-gate-stats',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.totals.repostAcks).toBeGreaterThanOrEqual(1)
    expect(body.items.some((i: { archiveItemId: string }) => i.archiveItemId === gatedItemId)).toBe(
      true,
    )
  })
})
