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

const PREFIX = 'acct-del-'

describe('M19 — account deletion execute', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let targetId: string
  let targetEmail: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const orphanChannels = await prisma.channel.findMany({
      where: { slug: { startsWith: 'acct-del-' } },
      select: { id: true, userId: true },
    })
    if (orphanChannels.length > 0) {
      const orphanUserIds = orphanChannels.map((c) => c.userId)
      await prisma.supportTicket.deleteMany({ where: { artistId: { in: orphanUserIds } } })
      for (const ch of orphanChannels) {
        await prisma.download.deleteMany({ where: { channelId: ch.id } })
      }
      await prisma.channel.deleteMany({ where: { slug: { startsWith: 'acct-del-' } } })
      await prisma.user.deleteMany({ where: { id: { in: orphanUserIds } } })
    }

    const stale = await prisma.user.findMany({
      where: { username: { startsWith: 'acct-del-' } },
      select: { id: true, channel: { select: { id: true } } },
    })
    if (stale.length > 0) {
      const staleIds = stale.map((u) => u.id)
      await prisma.supportTicket.deleteMany({ where: { artistId: { in: staleIds } } })
      for (const u of stale) {
        if (u.channel) await prisma.download.deleteMany({ where: { channelId: u.channel.id } })
      }
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } })
    }

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'acct-del-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const target = await createTestArtist(prisma, {
      email: `${PREFIX}target@example.com`,
      username: 'acct-del-target',
    })
    targetId = target.id
    targetEmail = target.email

    await prisma.supportTicket.create({
      data: {
        artistId: targetId,
        subject: 'Account deletion request',
        message: 'Please delete',
        category: 'OTHER',
      },
    })
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST delete-account requires board role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/delete-account`,
      headers: { cookie: await sessionCookieFor(prisma, targetId) },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST delete-account anonymizes user', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: targetId } })
    const sound = await prisma.sound.create({
      data: {
        channelId: channel.id,
        title: 'Left behind',
        status: 'READY',
        isPublic: true,
      },
    })
    const collection = await prisma.collection.create({
      data: { userId: targetId, name: 'Left behind', slug: `acct-del-col-${Date.now()}` },
    })

    const board = await prisma.user.findUniqueOrThrow({
      where: { email: `${PREFIX}board@example.com` },
      select: { channel: { select: { id: true } } },
    })
    await prisma.apiToken.create({
      data: {
        userId: targetId,
        name: 'cli',
        tokenHash: `acct-del-hash-${Date.now()}`,
        tokenPrefix: 'tahti_ab',
      },
    })
    await prisma.integrationCredential.create({
      data: { userId: targetId, providerSlug: 'acct-del-provider', fieldsEnc: 'secret' },
    })
    await prisma.rtmpTarget.create({
      data: {
        channelId: channel.id,
        provider: 'YOUTUBE',
        label: 'YouTube',
        rtmpUrl: 'rtmp://example.com/live',
        streamKeyEnc: 'secret',
      },
    })
    await prisma.channelModerator.create({
      data: { channelId: board.channel!.id, userId: targetId },
    })
    await prisma.user.update({
      where: { id: targetId },
      data: {
        totpSecretEnc: 'secret',
        totpEnabledAt: new Date(),
        soundcloudAccessTokenEnc: 'secret',
        googleDriveRefreshTokenEnc: 'secret',
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/delete-account`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().fanSubscriptionsCanceled).toBe(0)

    expect(await prisma.apiToken.count({ where: { userId: targetId } })).toBe(0)
    expect(await prisma.integrationCredential.count({ where: { userId: targetId } })).toBe(0)
    expect(await prisma.rtmpTarget.count({ where: { channelId: channel.id } })).toBe(0)
    expect(await prisma.channelModerator.count({ where: { userId: targetId } })).toBe(0)
    const wiped = await prisma.user.findUniqueOrThrow({ where: { id: targetId } })
    expect(wiped.totpSecretEnc).toBeNull()
    expect(wiped.totpEnabledAt).toBeNull()
    expect(wiped.soundcloudAccessTokenEnc).toBeNull()
    expect(wiped.googleDriveRefreshTokenEnc).toBeNull()

    const user = await prisma.user.findUnique({ where: { id: targetId } })
    expect(user?.deletedAt).not.toBeNull()
    expect(user?.email).not.toBe(targetEmail)
    expect(user?.displayName).toBe('Deleted user')

    const hiddenSound = await prisma.sound.findUnique({ where: { id: sound.id } })
    expect(hiddenSound?.isPublic).toBe(false)
    const hiddenCollection = await prisma.collection.findUnique({ where: { id: collection.id } })
    expect(hiddenCollection?.isPublic).toBe(false)
    expect(hiddenCollection?.visibility).toBe('DRAFT')
    const page = await app.inject({ method: 'GET', url: `/api/tracks/${sound.id}` })
    expect(page.statusCode).toBe(404)

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: targetEmail, password: 'testpassword' },
    })
    expect(login.statusCode).toBe(401)
  })

  it('POST delete-account drops future radio bookings and events, keeps past ones', async () => {
    const victim = await createTestArtist(prisma, {
      email: `${PREFIX}future@example.com`,
      username: 'acct-del-future',
    })
    const hour = 3600_000
    const now = Date.now()
    const pastBooking = await prisma.radioSlotBooking.create({
      data: {
        channelId: victim.channel!.id,
        startAt: new Date(now - 48 * hour),
        endAt: new Date(now - 47 * hour),
      },
    })
    const futureBooking = await prisma.radioSlotBooking.create({
      data: {
        channelId: victim.channel!.id,
        startAt: new Date(now + 47 * hour),
        endAt: new Date(now + 48 * hour),
      },
    })
    const pastEvent = await prisma.artistEvent.create({
      data: {
        userId: victim.id,
        title: 'Old gig',
        place: 'Club',
        location: 'Helsinki',
        startAt: new Date(now - 48 * hour),
      },
    })
    const futureEvent = await prisma.artistEvent.create({
      data: {
        userId: victim.id,
        title: 'Next gig',
        place: 'Club',
        location: 'Helsinki',
        startAt: new Date(now + 48 * hour),
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${victim.id}/delete-account`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)

    expect(await prisma.radioSlotBooking.findUnique({ where: { id: futureBooking.id } })).toBeNull()
    expect(await prisma.artistEvent.findUnique({ where: { id: futureEvent.id } })).toBeNull()
    expect(
      await prisma.radioSlotBooking.findUnique({ where: { id: pastBooking.id } }),
    ).not.toBeNull()
    expect(await prisma.artistEvent.findUnique({ where: { id: pastEvent.id } })).not.toBeNull()
  })
})
