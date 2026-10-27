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

const PREFIX = 'export-made-'

describe('GET /api/me/data-export.json — stations, themes, embeds, support replies', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
    })
    cookie = await sessionCookieFor(prisma, user.id)
    const ticket = await prisma.supportTicket.create({
      data: { artistId: user.id, subject: `${PREFIX}upload`, message: 'Help', category: 'OTHER' },
    })
    await prisma.supportTicketNote.createMany({
      data: [
        { ticketId: ticket.id, authorId: board.id, body: 'Board answer' },
        { ticketId: ticket.id, authorId: user.id, body: 'Still broken' },
        { ticketId: ticket.id, authorId: user.id, body: 'Status', kind: 'STATUS_CHANGE' },
      ],
    })
    await prisma.internetRadioStation.create({
      data: { userId: user.id, name: 'Night FM', streamUrl: 'https://radio.example/stream' },
    })
    await prisma.theme.create({
      data: { userId: user.id, name: 'Dusk', varsJson: { bg: 'black' }, darkJson: {} },
    })
    await prisma.artistEmbed.create({
      data: { userId: user.id, provider: 'youtube', url: 'https://youtu.be/x', title: 'Video' },
    })
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({ where: { subject: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists what the account added and its own follow-ups', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.supportReplies).toEqual([
      expect.objectContaining({ body: 'Still broken', ticket: { subject: `${PREFIX}upload` } }),
    ])
    expect(body.radioStations[0]).toMatchObject({
      name: 'Night FM',
      streamUrl: 'https://radio.example/stream',
    })
    expect(body.themes[0]).toMatchObject({ name: 'Dusk', varsJson: { bg: 'black' } })
    expect(body.embeds[0]).toMatchObject({ provider: 'youtube', title: 'Video' })
  })
})
