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

const PREFIX = 'mention-api-'

describe('M15 — mention settings API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'mention-api-user',
    })
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('PATCH /api/me/mentions/settings toggles mentionsEnabled', async () => {
    const off = await app.inject({
      method: 'PATCH',
      url: '/api/me/mentions/settings',
      headers: { cookie },
      payload: { mentionsEnabled: false },
    })
    expect(off.statusCode).toBe(200)
    expect(off.json().mentionsEnabled).toBe(false)
    expect(off.json().publicMentionsEnabled).toBe(false)

    const user = await prisma.user.findUnique({ where: { username: 'mention-api-user' } })
    expect(user?.mentionsEnabled).toBe(false)

    const pub = await app.inject({
      method: 'PATCH',
      url: '/api/me/mentions/settings',
      headers: { cookie },
      payload: { publicMentionsEnabled: true },
    })
    expect(pub.statusCode).toBe(200)
    expect(pub.json().publicMentionsEnabled).toBe(true)

    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/me/mentions/settings',
      headers: { cookie },
      payload: { mentionsEnabled: 'no' },
    })
    expect(bad.statusCode).toBe(400)
  })

  it('mute and unmute handles', async () => {
    await createTestArtist(prisma, {
      email: `${PREFIX}target@example.com`,
      username: 'mention-target',
    })

    const mute = await app.inject({
      method: 'POST',
      url: '/api/me/mentions/mute/mention-target',
      headers: { cookie },
    })
    expect(mute.statusCode).toBe(201)

    const self = await app.inject({
      method: 'POST',
      url: '/api/me/mentions/mute/mention-api-user',
      headers: { cookie },
    })
    expect(self.statusCode).toBe(400)

    const unmute = await app.inject({
      method: 'DELETE',
      url: '/api/me/mentions/mute/mention-target',
      headers: { cookie },
    })
    expect(unmute.statusCode).toBe(200)

    const muter = await prisma.user.findUnique({ where: { username: 'mention-api-user' } })
    const targetUser = await prisma.user.findUnique({ where: { username: 'mention-target' } })
    const count = await prisma.mentionMute.count({
      where: { muterId: muter!.id, targetUserId: targetUser!.id },
    })
    expect(count).toBe(0)
  })

  it('never names a muted handle or a mentioner by an email address', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}emailname@example.com`,
      username: 'mention-email-name',
      displayName: 'mentioner@example.com',
    })
    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'mention-api-user' } })
    await prisma.mention.create({
      data: {
        mentionerUserId: mentioner.id,
        targetUserId: user.id,
        surface: 'BIO',
        sourceId: mentioner.id,
      },
    })
    const list = await app.inject({ method: 'GET', url: '/api/me/mentions', headers: { cookie } })
    const { mentions } = list.json() as {
      mentions: Array<{ mentioner: { username: string; displayName: string } }>
    }
    expect(mentions[0]!.mentioner).toMatchObject({
      username: 'mention-email-name',
      displayName: 'mention-email-name',
    })

    const mute = await app.inject({
      method: 'POST',
      url: '/api/me/mentions/mute/mention-email-name',
      headers: { cookie },
    })
    expect(mute.statusCode).toBe(201)

    const settings = await app.inject({
      method: 'GET',
      url: '/api/me/mentions/settings',
      headers: { cookie },
    })
    expect((settings.json() as { muted: unknown[] }).muted).toContainEqual({
      username: 'mention-email-name',
      displayName: 'mention-email-name',
    })

    const afterMute = await app.inject({
      method: 'GET',
      url: '/api/me/mentions',
      headers: { cookie },
    })
    expect(afterMute.body).not.toContain('mention-email-name')
  })

  it('says where each mention happened', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}source@example.com`,
      username: 'mention-source',
    })
    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'mention-api-user' } })
    const sound = await prisma.sound.create({
      data: {
        channelId: mentioner.channel!.id,
        title: 'Source Track',
        status: 'READY',
        isPublic: true,
      },
    })
    const release = await prisma.release.create({
      data: {
        userId: mentioner.id,
        title: 'Source Release',
        type: 'EP',
        releaseDate: new Date(),
        smartLinkSlug: `${PREFIX}source-release`,
        state: 'PUBLISHED',
      },
    })
    await prisma.mention.createMany({
      data: [
        { surface: 'TRACKLIST' as const, sourceId: sound.id },
        { surface: 'RELEASE' as const, sourceId: release.id },
      ].map((row) => ({ ...row, mentionerUserId: mentioner.id, targetUserId: user.id })),
    })

    const res = await app.inject({ method: 'GET', url: '/api/me/mentions', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const { mentions } = res.json() as {
      mentions: Array<{ surface: string; sourceTitle: string | null; sourceUrl: string | null }>
    }
    expect(mentions.find((m) => m.surface === 'TRACKLIST')).toMatchObject({
      sourceTitle: 'Source Track',
      sourceUrl: `/t/${sound.id}`,
    })
    expect(mentions.find((m) => m.surface === 'RELEASE')).toMatchObject({
      sourceTitle: 'Source Release',
      sourceUrl: `/r/${PREFIX}source-release`,
    })
  })

  it('falls back to 20 mentions when limit is not a number', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/mentions?limit=abc',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
  })

  it('leaves out mentions from blocked and suspended accounts until the block is lifted', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'mention-api-user' } })
    const make = async (name: string) => {
      const mentioner = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `mention-${name}`,
      })
      await prisma.mention.create({
        data: {
          mentionerUserId: mentioner.id,
          targetUserId: user.id,
          surface: 'BIO',
          sourceId: mentioner.id,
        },
      })
      return mentioner
    }
    const blockedByMe = await make('hide-blocked')
    const blockedMe = await make('hide-blocker')
    const suspended = await make('hide-suspended')
    await make('hide-kept')
    await prisma.userBlock.createMany({
      data: [
        { blockerUserId: user.id, blockedUserId: blockedByMe.id },
        { blockerUserId: blockedMe.id, blockedUserId: user.id },
      ],
    })
    await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })

    const names = async () => {
      const res = await app.inject({ method: 'GET', url: '/api/me/mentions', headers: { cookie } })
      return (res.json() as { mentions: Array<{ mentioner: { username: string } }> }).mentions.map(
        (m) => m.mentioner.username,
      )
    }
    const listed = await names()
    expect(listed).toContain('mention-hide-kept')
    expect(listed).not.toContain('mention-hide-blocked')
    expect(listed).not.toContain('mention-hide-blocker')
    expect(listed).not.toContain('mention-hide-suspended')

    await prisma.userBlock.deleteMany({ where: { blockerUserId: user.id } })
    expect(await names()).toContain('mention-hide-blocked')
  })
})
