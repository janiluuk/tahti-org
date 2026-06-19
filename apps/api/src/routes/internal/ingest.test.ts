// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * PLAT-004: internal ingest callbacks (Icecast + RTMP) with form-encoded bodies.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { utcWeekStart } from '@tahti/shared/broadcast-cap'

const { enqueueFinalizeBroadcastRecording, enqueueWarmArchiveFallbackCache } = vi.hoisted(() => ({
  enqueueFinalizeBroadcastRecording: vi.fn().mockResolvedValue(undefined),
  enqueueWarmArchiveFallbackCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/queue.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/queue.js')>()
  return {
    ...actual,
    enqueueFinalizeBroadcastRecording,
    enqueueWarmArchiveFallbackCache,
  }
})

const PREFIX = 'ingest-test-'
const SLUG = 'ingest-artist'
const STREAM_KEY = `${SLUG}__ingest-secret`

describe('internal ingest (RTMP + Icecast)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let liveSourcePass: string
  let channelId: string

  beforeAll(async () => {
    enqueueFinalizeBroadcastRecording.mockClear()
    enqueueWarmArchiveFallbackCache.mockClear()
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

  it('allows RTMP on_publish with previous stream key during hot rotation grace (ARTIST-002)', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
    const newKey = `${SLUG}__rotated-key`
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        rtmpStreamKey: newKey,
        rtmpStreamKeyHash: await hashPassword(newKey),
        rtmpStreamKeyPreviousHash: channel.rtmpStreamKeyHash,
        rtmpStreamKeyPreviousExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_publish',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `name=${encodeURIComponent(STREAM_KEY)}`,
    })
    expect(res.statusCode).toBe(200)

    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        state: 'OFFLINE',
        goneLiveAt: null,
        rtmpStreamKey: STREAM_KEY,
        rtmpStreamKeyHash: await hashPassword(STREAM_KEY),
        rtmpStreamKeyPreviousHash: null,
        rtmpStreamKeyPreviousExpiresAt: null,
      },
    })
  })

  it('denies RTMP on_publish when previous stream key grace expired (ARTIST-002)', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
    const newKey = `${SLUG}__rotated-key`
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        rtmpStreamKey: newKey,
        rtmpStreamKeyHash: await hashPassword(newKey),
        rtmpStreamKeyPreviousHash: channel.rtmpStreamKeyHash,
        rtmpStreamKeyPreviousExpiresAt: new Date(Date.now() - 60_000),
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_publish',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `name=${encodeURIComponent(STREAM_KEY)}`,
    })
    expect(res.statusCode).toBe(403)

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        rtmpStreamKey: STREAM_KEY,
        rtmpStreamKeyHash: await hashPassword(STREAM_KEY),
        rtmpStreamKeyPreviousHash: null,
        rtmpStreamKeyPreviousExpiresAt: null,
      },
    })
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
    expect(enqueueWarmArchiveFallbackCache).toHaveBeenCalledWith(channelId)

    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
  })

  it('ends broadcast on RTMP on_done and enqueues partial archive finalize', async () => {
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

    const ended = await prisma.broadcast.findFirst({
      where: { channelId },
      orderBy: { startedAt: 'desc' },
    })
    expect(ended?.endedAt).toBeTruthy()
    expect(enqueueFinalizeBroadcastRecording).toHaveBeenCalledWith(ended!.id)
  })

  it('ends broadcast on Icecast disconnect and enqueues partial archive finalize', async () => {
    enqueueFinalizeBroadcastRecording.mockClear()

    await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `mount=/live/${SLUG}&pass=${liveSourcePass}`,
    })

    const disconnect = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_disconnect',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `mount=/live/${SLUG}`,
    })
    expect(disconnect.statusCode).toBe(200)

    const ended = await prisma.broadcast.findFirst({
      where: { channelId },
      orderBy: { startedAt: 'desc' },
    })
    expect(ended?.endedAt).toBeTruthy()
    expect(enqueueFinalizeBroadcastRecording).toHaveBeenCalledWith(ended!.id)

    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
  })

  it('allows Icecast on_connect with urlencoded mount and pass', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `mount=/live/${SLUG}&pass=${liveSourcePass}`,
    })
    expect(res.statusCode).toBe(200)

    expect(enqueueWarmArchiveFallbackCache).toHaveBeenCalledWith(channelId)

    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
  })

  it('allows Icecast on_connect with previous password during hot rotation grace (ARTIST-002)', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
    const newPass = 'new-ice-pass'
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        liveSourcePass: newPass,
        liveSourcePassHash: await hashPassword(newPass),
        liveSourcePassPreviousHash: channel.liveSourcePassHash,
        liveSourcePassPreviousExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

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
      data: {
        state: 'OFFLINE',
        goneLiveAt: null,
        liveSourcePass,
        liveSourcePassHash: channel.liveSourcePassHash,
        liveSourcePassPreviousHash: null,
        liveSourcePassPreviousExpiresAt: null,
      },
    })
  })

  it('rejects Icecast disconnect from a public IP without internal auth (SEC-001)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_disconnect',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-for': '203.0.113.50',
      },
      payload: `mount=/live/${SLUG}`,
    })
    expect(res.statusCode).toBe(403)
  })
})
