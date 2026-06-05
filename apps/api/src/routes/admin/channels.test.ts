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

const PREFIX = 'admin-channels-'

describe('M21-C — admin force-offline', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let channelSlug: string
  let channelId: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-ch-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-ch-artist',
    })
    artistId = artist.id
    channelId = artist.channel!.id
    channelSlug = artist.channel!.slug

    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'LIVE', goneLiveAt: new Date() },
    })

    await prisma.broadcast.create({
      data: { channelId, startedAt: new Date(), source: 'ICECAST' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST force-offline ends live broadcast and sets OFFLINE', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/channels/${channelSlug}/force-offline`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; channelId: string }
    expect(body.ok).toBe(true)
    expect(body.channelId).toBe(channelId)

    const ch = await prisma.channel.findUnique({ where: { id: channelId } })
    expect(ch?.state).toBe('OFFLINE')
    expect(ch?.goneLiveAt).toBeNull()

    const broadcast = await prisma.broadcast.findFirst({
      where: { channelId },
      orderBy: { startedAt: 'desc' },
    })
    expect(broadcast?.endedAt).toBeTruthy()

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'STREAM_FORCE_OFFLINE', targetId: artistId },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).toBeTruthy()
  })

  it('returns 409 when channel is not live', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/channels/${channelSlug}/force-offline`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(409)
  })
})
