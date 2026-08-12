// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const restartChannelLiquidsoap = vi.fn().mockResolvedValue(undefined)
const skipChannelTrack = vi.fn().mockResolvedValue(undefined)
const pauseChannelRotation = vi.fn().mockResolvedValue(undefined)
const resumeChannelRotation = vi.fn().mockResolvedValue(undefined)

vi.mock('../../lib/orchestrator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/orchestrator.js')>()
  return {
    ...actual,
    restartChannelLiquidsoap: (...args: unknown[]) => restartChannelLiquidsoap(...args),
    skipChannelTrack: (...args: unknown[]) => skipChannelTrack(...args),
    pauseChannelRotation: (...args: unknown[]) => pauseChannelRotation(...args),
    resumeChannelRotation: (...args: unknown[]) => resumeChannelRotation(...args),
  }
})

const PREFIX = 'admin-stream-ctl-'

describe('admin stream controls', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let channelSlug: string
  let channelId: string
  let artistId: string
  let broadcastId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-stream-ctl-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-stream-ctl-artist',
    })
    artistId = artist.id
    channelId = artist.channel!.id
    channelSlug = artist.channel!.slug

    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'LIVE', goneLiveAt: new Date() },
    })

    const broadcast = await prisma.broadcast.create({
      data: { channelId, startedAt: new Date(), source: 'ICECAST' },
    })
    broadcastId = broadcast.id
  })

  beforeEach(() => {
    restartChannelLiquidsoap.mockClear()
    skipChannelTrack.mockClear()
    pauseChannelRotation.mockClear()
    resumeChannelRotation.mockClear()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST restart bounces Liquidsoap and audits', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/channels/${channelSlug}/restart`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; action: string; channelId: string }
    expect(body).toMatchObject({ ok: true, action: 'restart', channelId })
    expect(restartChannelLiquidsoap).toHaveBeenCalledWith(
      channelId,
      channelSlug,
      broadcastId,
      'channel',
    )

    const ch = await prisma.channel.findUnique({ where: { id: channelId } })
    expect(ch?.state).toBe('LIVE')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'STREAM_RESTART', targetId: artistId },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).toBeTruthy()
  })

  it('POST skip / pause / resume call orchestrator transport', async () => {
    for (const [path, mock] of [
      ['skip', skipChannelTrack],
      ['pause', pauseChannelRotation],
      ['resume', resumeChannelRotation],
    ] as const) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/channels/${channelSlug}/${path}`,
        headers: { cookie: boardCookie },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ ok: true, action: path, channelId })
      expect(mock).toHaveBeenCalledWith(channelId)
    }
  })

  it('returns 409 when restarting a channel that is not live', async () => {
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { endedAt: new Date() },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/channels/${channelSlug}/restart`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(restartChannelLiquidsoap).not.toHaveBeenCalled()
  })
})
