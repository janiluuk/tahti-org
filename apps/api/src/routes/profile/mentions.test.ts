// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'pub-mention-'

describe('M15 — public mentions API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let targetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}mentioner@example.com`,
      username: 'pub-mentioner',
    })
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}target@example.com`,
      username: 'pub-mention-target',
    })
    targetId = target.id

    await prisma.mention.create({
      data: {
        mentionerUserId: mentioner.id,
        targetUserId: target.id,
        surface: 'BIO',
        sourceId: mentioner.id,
      },
    })

    const sound = await prisma.sound.create({
      data: {
        channelId: mentioner.channel!.id,
        title: 'Aurora Drift',
        status: 'READY',
      },
    })
    await prisma.mention.create({
      data: {
        mentionerUserId: mentioner.id,
        targetUserId: target.id,
        surface: 'TRACKLIST',
        sourceId: sound.id,
      },
    })

    const announcement = await prisma.channelAnnouncement.create({
      data: { channelId: mentioner.channel!.id, body: 'hey @pub-mention-target' },
    })
    await prisma.mention.create({
      data: {
        mentionerUserId: mentioner.id,
        targetUserId: target.id,
        surface: 'ANNOUNCEMENT',
        sourceId: announcement.id,
      },
    })

    await prisma.mention.create({
      data: {
        mentionerUserId: mentioner.id,
        targetUserId: target.id,
        surface: 'CHAT',
        sourceId: `chat:${mentioner.channel!.id}:${Date.now()}:${mentioner.id}`,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns 404 when public mentions disabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    expect(res.statusCode).toBe(404)
  })

  it('resolves a real sourceUrl per surface', async () => {
    await prisma.user.update({
      where: { id: targetId },
      data: { publicMentionsEnabled: true },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{
      surface: string
      sourceUrl: string | null
      sourceTitle: string | null
      mentioner: { username: string }
    }>
    expect(body.length).toBe(4)
    for (const m of body) {
      expect(m.mentioner.username).toBe('pub-mentioner')
    }

    const bySurface = Object.fromEntries(body.map((m) => [m.surface, m]))
    expect(bySurface.BIO?.sourceUrl).toBe('/u/pub-mentioner')
    expect(bySurface.TRACKLIST?.sourceUrl).toMatch(/^\/t\//)
    expect(bySurface.TRACKLIST?.sourceTitle).toBe('Aurora Drift')
    expect(bySurface.ANNOUNCEMENT?.sourceUrl).toBe('/channel/pub-mentioner')
    expect(bySurface.CHAT?.sourceUrl).toBe('/chat/pub-mentioner')
  })
})
