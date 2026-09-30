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

const PREFIX = 'member-picture-clear-'

describe('PATCH /api/me/channel/members/:id — picture removal', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let memberId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'member-picture-clear-artist',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const member = await prisma.channelMember.create({
      data: {
        channelId: artist.channel!.id,
        name: 'Ada',
        role: 'Vocals',
        position: 0,
        pictureUrl: 'https://media.tahti.live/channel-members/x/ada.jpg',
      },
    })
    memberId = member.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('removes the picture with pictureUrl: null', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/members/${memberId}`,
      headers: { cookie },
      payload: { pictureUrl: null },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ name: 'Ada', pictureUrl: null })
  })

  it('does not accept a picture URL directly', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/members/${memberId}`,
      headers: { cookie },
      payload: { pictureUrl: 'https://elsewhere.example/ada.jpg' },
    })
    expect(res.statusCode).toBe(400)
    const stored = await prisma.channelMember.findUnique({ where: { id: memberId } })
    expect(stored?.pictureUrl).toBeNull()
  })
})
