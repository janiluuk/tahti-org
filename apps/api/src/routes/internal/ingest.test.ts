// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * PLAT-004: internal ingest callbacks (Icecast + RTMP) with form-encoded bodies.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { utcWeekStart } from '@tahti/shared/broadcast-cap'

const PREFIX = 'ingest-test-'
const SLUG = 'ingest-artist'
const STREAM_KEY = `${SLUG}__ingest-secret`

describe('internal ingest (RTMP + Icecast)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let liveSourcePass: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    liveSourcePass = 'ingest-ice-pass'
    const liveSourcePassHash = await hashPassword(liveSourcePass)
    const rtmpStreamKeyHash = await hashPassword(STREAM_KEY)

    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash: await hashPassword('testpassword'),
        username: SLUG,
        displayName: 'Ingest Test',
        tier: 'ARTIST',
        weeklyLiveSecondsUsed: 0,
        weeklyLiveResetAt: utcWeekStart(new Date()),
        channel: {
          create: {
            slug: SLUG,
            liveSourceMount: `/live/${SLUG}`,
            liveSourcePass,
            liveSourcePassHash,
            rtmpStreamKey: STREAM_KEY,
            rtmpStreamKeyHash,
          },
        },
      },
      include: { channel: true },
    })
    channelId = user.channel!.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('denies RTMP on_publish for unknown stream name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_publish',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'name=no-such__key',
    })
    expect(res.statusCode).toBe(403)
  })

  it('denies RTMP on_publish with invalid stream key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_publish',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `name=${SLUG}__wrong-key`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('allows RTMP on_publish with valid form-encoded key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_publish',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `name=${encodeURIComponent(STREAM_KEY)}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('allowed')

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    expect(channel?.state).toBe('LIVE')

    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
  })

  it('ends broadcast on RTMP on_done', async () => {
    await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_publish',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `name=${encodeURIComponent(STREAM_KEY)}`,
    })

    const done = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_done',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `name=${encodeURIComponent(STREAM_KEY)}`,
    })
    expect(done.statusCode).toBe(200)

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    expect(channel?.state).toBe('OFFLINE')
    const open = await prisma.broadcast.findFirst({
      where: { channelId, endedAt: null },
    })
    expect(open).toBeNull()
  })

  it('allows Icecast on_connect with urlencoded mount and pass', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `mount=/live/${SLUG}&pass=${liveSourcePass}`,
    })
    expect(res.statusCode).toBe(200)

    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
  })
})
