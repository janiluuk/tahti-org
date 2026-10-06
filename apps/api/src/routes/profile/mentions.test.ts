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

  let mentionerId: string
  let mentionerChannelId: string

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
    mentionerId = mentioner.id
    mentionerChannelId = mentioner.channel!.id

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
        isPublic: true,
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

  it("does not name or link a private track's tracklist mention", async () => {
    const hidden = await prisma.sound.create({
      data: {
        channelId: mentionerChannelId,
        title: 'Unreleased Secret',
        status: 'READY',
        isPublic: false,
      },
    })
    await prisma.mention.create({
      data: {
        mentionerUserId: mentionerId,
        targetUserId: targetId,
        surface: 'TRACKLIST',
        sourceId: hidden.id,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    const hiddenMention = (
      res.json() as Array<{
        sourceId: string
        sourceTitle: string | null
        sourceUrl: string | null
      }>
    ).find((m) => m.sourceId === hidden.id)
    expect(hiddenMention).toMatchObject({ sourceTitle: null, sourceUrl: null })
    expect(res.body).not.toContain('Unreleased Secret')
  })

  it('links a release mention once the release is published', async () => {
    const [published, draft] = await Promise.all(
      (['PUBLISHED', 'DRAFT'] as const).map((state) =>
        prisma.release.create({
          data: {
            userId: mentionerId,
            title: `Pub Mention ${state}`,
            type: 'EP',
            releaseDate: new Date(),
            smartLinkSlug: `${PREFIX}${state.toLowerCase()}`,
            state,
          },
        }),
      ),
    )
    await prisma.mention.createMany({
      data: [published, draft].map((release) => ({
        mentionerUserId: mentionerId,
        targetUserId: targetId,
        surface: 'RELEASE' as const,
        sourceId: release.id,
      })),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    const body = res.json() as Array<{
      sourceId: string
      sourceTitle: string | null
      sourceUrl: string | null
    }>
    expect(body.find((m) => m.sourceId === published.id)).toMatchObject({
      sourceTitle: 'Pub Mention PUBLISHED',
      sourceUrl: `/r/${PREFIX}published`,
    })
    expect(body.find((m) => m.sourceId === draft.id)).toMatchObject({
      sourceTitle: null,
      sourceUrl: null,
    })
    expect(res.body).not.toContain('Pub Mention DRAFT')
  })

  it('never sends an email address as the mentioner name', async () => {
    await prisma.user.update({
      where: { id: mentionerId },
      data: { displayName: 'someone@example.com' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    expect(res.body).not.toContain('someone@example.com')
    const bio = (
      res.json() as Array<{
        surface: string
        sourceTitle: string
        mentioner: { displayName: string }
      }>
    ).find((m) => m.surface === 'BIO')
    expect(bio?.mentioner.displayName).toBe('pub-mentioner')
    expect(bio?.sourceTitle).toBe('pub-mentioner')
  })

  it('leaves out mentions by someone the artist muted', async () => {
    await prisma.mentionMute.create({ data: { muterId: targetId, targetUserId: mentionerId } })

    const muted = await app.inject({ method: 'GET', url: '/api/v1/u/pub-mention-target/mentions' })
    expect(muted.json()).toEqual([])

    await prisma.mentionMute.deleteMany({ where: { muterId: targetId } })
    const unmuted = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    expect((unmuted.json() as unknown[]).length).toBeGreaterThan(0)
  })

  it('leaves out mentions by a suspended account', async () => {
    await prisma.user.update({ where: { id: mentionerId }, data: { suspendedAt: new Date() } })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})
