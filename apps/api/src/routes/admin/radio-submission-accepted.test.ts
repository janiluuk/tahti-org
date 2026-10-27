// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTahtiRadioChannel,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'radio-accepted-notice-'

describe('The artist is told when Tahti Radio takes a submission', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistId: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await createTahtiRadioChannel(prisma)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    artistId = artist.id
    channelId = artist.channel!.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function submit(title: string, isPublic: boolean) {
    const sound = await prisma.sound.create({
      data: { channelId, title, status: 'READY', isPublic },
    })
    const batch = await prisma.radioTrackSubmissionBatch.create({
      data: {
        submitterId: artistId,
        channelId,
        items: { create: { soundId: sound.id, positionInBatch: 0 } },
      },
      include: { items: true },
    })
    return batch.items[0].id
  }

  const approve = (id: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/radio-submissions/${id}/approve`,
      headers: { cookie: boardCookie },
    })

  it('notifies on approval and says when the track was made public', async () => {
    expect((await approve(await submit('Public one', true))).statusCode).toBe(200)
    expect((await approve(await submit('Private one', false))).statusCode).toBe(200)

    const notices = await prisma.notification.findMany({
      where: { userId: artistId, type: 'RADIO_SUBMISSION_ACCEPTED' },
      orderBy: { createdAt: 'asc' },
    })
    expect(notices.map((n) => [n.title, n.body])).toEqual([
      ['"Public one" is now on Tahti Radio', null],
      ['"Private one" is now on Tahti Radio', 'The track was private, so it is now public.'],
    ])
  })
})
