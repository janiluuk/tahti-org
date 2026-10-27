// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'report-board-notice-'

describe('Board is told about new content reports', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardId: string
  let soundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardId = board.id
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const sound = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: `${PREFIX}reported track`,
        status: 'READY',
        isPublic: true,
      },
    })
    soundId = sound.id
  })

  afterAll(async () => {
    await prisma.contentReport.deleteMany({ where: { targetId: soundId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const report = () =>
    app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: { targetType: 'SOUND_ITEM', targetId: soundId, reason: 'COPYRIGHT' },
    })

  const notices = () =>
    prisma.notification.findMany({ where: { userId: boardId, type: 'CONTENT_REPORTED' } })

  it('notifies the board once per report, not for a repeat', async () => {
    expect((await report()).statusCode).toBe(201)
    const first = await notices()
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({
      title: `New report: ${PREFIX}reported track`,
      body: 'Reason: Copyright',
      url: '/admin/moderation/content-reports',
    })

    expect((await report()).statusCode).toBe(200)
    expect(await notices()).toHaveLength(1)
  })
})
