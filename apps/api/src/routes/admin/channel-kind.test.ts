// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-channel-kind-test-'

describe('PATCH /api/admin/channels/:slug/kind', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistCookie: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-channel-kind-board',
      isBoard: true,
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-channel-kind-station',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    artistId = artist.id
    artistCookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { targetId: artistId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  function setKind(cookie: string, channelKind: string, slug = 'admin-channel-kind-station') {
    return app.inject({
      method: 'PATCH',
      url: `/api/admin/channels/${slug}/kind`,
      headers: { cookie },
      payload: { channelKind },
    })
  }

  it('turns a channel into a radio station, audits it and shows it publicly', async () => {
    const res = await setKind(boardCookie, 'RADIO')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ slug: 'admin-channel-kind-station', channelKind: 'RADIO' })

    const pub = await app.inject({ method: 'GET', url: '/api/channels/admin-channel-kind-station' })
    expect(pub.json().channelKind).toBe('RADIO')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CHANNEL_KIND_CHANGE', targetId: artistId },
    })
    expect(audit?.meta).toMatchObject({ from: 'ARTIST', to: 'RADIO' })

    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/users/${artistId}`,
      headers: { cookie: boardCookie },
    })
    expect(detail.json().channel.channelKind).toBe('RADIO')
  })

  it('does not audit a no-op change', async () => {
    const before = await prisma.auditLog.count({ where: { targetId: artistId } })
    expect((await setKind(boardCookie, 'RADIO')).statusCode).toBe(200)
    expect(await prisma.auditLog.count({ where: { targetId: artistId } })).toBe(before)
  })

  it('rejects unknown kinds, unknown channels and non-board callers', async () => {
    expect((await setKind(boardCookie, 'PODCAST')).statusCode).toBe(400)
    expect((await setKind(boardCookie, 'ARTIST', 'no-such-channel-xyz')).statusCode).toBe(404)
    expect((await setKind(artistCookie, 'ARTIST')).statusCode).toBe(403)
  })
})
