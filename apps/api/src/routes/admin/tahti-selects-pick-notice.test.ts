// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'selects-pick-notice-'

describe('The artist is told about a Tahti Selects pick', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistId: string
  let soundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const selects = await prisma.channel.findUnique({ where: { slug: TAHTI_SELECTS_SLUG } })
    if (!selects) {
      await createTestArtist(prisma, {
        email: `${PREFIX}selects@example.com`,
        username: TAHTI_SELECTS_SLUG,
      })
    }
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    artistId = artist.id
    const sound = await prisma.sound.create({
      data: { channelId: artist.channel!.id, title: 'Aamu', status: 'READY', isPublic: true },
    })
    soundId = sound.id
  })

  afterAll(async () => {
    await prisma.curatedRotationItem.deleteMany({ where: { soundId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('notifies the artist when the board adds their track', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tahti-selects/items',
      headers: { cookie: boardCookie },
      payload: { soundId },
    })
    expect(res.statusCode).toBe(201)
    const notices = await prisma.notification.findMany({
      where: { userId: artistId, type: 'TAHTI_SELECTS_PICK' },
    })
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      title: '"Aamu" was picked for Tahti Selects',
      url: `/c/${TAHTI_SELECTS_SLUG}`,
    })
  })
})
