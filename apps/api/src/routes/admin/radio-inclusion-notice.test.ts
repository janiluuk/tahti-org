// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'radio-inclusion-notice-'

describe('The channel owner is told when the board changes Tahti Radio inclusion', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let ownerId: string
  let channelId: string

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
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    ownerId = owner.id
    channelId = owner.channel!.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const call = (method: 'POST' | 'DELETE') =>
    app.inject({
      method,
      url: `/api/admin/radio/opt-out/${channelId}`,
      headers: { cookie: boardCookie },
    })

  it('notifies on each change, not on a repeat', async () => {
    expect((await call('POST')).statusCode).toBe(200)
    expect((await call('POST')).statusCode).toBe(200)
    expect((await call('DELETE')).statusCode).toBe(200)
    const titles = (
      await prisma.notification.findMany({
        where: { userId: ownerId, type: 'TAHTI_RADIO_INCLUSION_CHANGED' },
        orderBy: { createdAt: 'asc' },
      })
    ).map((n) => n.title)
    expect(titles).toEqual([
      'The board took your channel out of Tahti Radio',
      'Your channel is back in the Tahti Radio rotation',
    ])
  })
})
