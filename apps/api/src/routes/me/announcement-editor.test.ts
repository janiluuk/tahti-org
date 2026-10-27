// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@tahti/db'

const mocks = vi.hoisted(() => ({
  enqueueRenderAnnouncementTrim: vi.fn(),
  enqueueWarmSoundFallbackCache: vi.fn(),
  channel: { findUnique: vi.fn() },
  sound: { findFirst: vi.fn() },
  announcementClip: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}))
vi.mock('../../lib/queue.js', () => mocks)
vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn(async () => 'https://audio.test/file.wav'),
  presignedPutUrl: vi.fn(),
}))
import routes from './announcements.js'
let app: ReturnType<typeof Fastify>
const settings = { startSec: 0, endSec: 5, normalize: true }
const apply = {
  renderToken: 'token',
  title: 'ID',
  isEnabled: true,
  placement: 'BETWEEN',
  targetSoundId: null,
  scheduleMode: 'AFTER_EVERY',
  everyNth: null,
}

beforeEach(async () => {
  vi.resetAllMocks()
  mocks.enqueueWarmSoundFallbackCache.mockResolvedValue(undefined)
  app = Fastify()
  app.decorate('prisma', {
    ...mocks,
    $transaction: async (fn: (tx: typeof mocks) => unknown) => fn(mocks),
  } as unknown as PrismaClient)
  app.addHook('preHandler', async (request) => {
    if (request.headers.authorization === 'owner')
      request.sessionUser = { id: 'owner' } as NonNullable<typeof request.sessionUser>
  })
  await app.register(routes)
  mocks.channel.findUnique.mockResolvedValue({ id: 'channel', slug: 'owner' })
  mocks.announcementClip.findFirst.mockResolvedValue({
    id: 'clip',
    originalAudioKey: 'original.wav',
    audioKey: 'on-air.wav',
    renderToken: 'token',
    draftStatus: 'READY',
    draftAudioKey: 'preview.wav',
    draftDurationSec: 5,
    draftSettings: settings,
  })
  mocks.announcementClip.updateMany.mockResolvedValue({ count: 1 })
})
afterEach(async () => {
  await app.close()
})
const post = (action: string, payload: unknown, auth = true) =>
  app.inject({
    method: 'POST',
    url: `/api/me/announcements/clip/editor/${action}`,
    headers: auth ? { authorization: 'owner' } : {},
    payload,
  })

describe('announcement audition and activation', () => {
  it('requires authentication and scopes lookups to the owner channel', async () => {
    expect((await post('preview', settings, false)).statusCode).toBe(401)
    mocks.announcementClip.findFirst.mockResolvedValue(null)
    expect((await post('preview', settings)).statusCode).toBe(404)
    expect(mocks.announcementClip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'clip', channelId: 'channel' } }),
    )
  })
  it('queues a draft without overwriting the on-air version or activation', async () => {
    const response = await post('preview', settings)
    expect(response.statusCode).toBe(200)
    const data = mocks.announcementClip.update.mock.calls[0]![0].data
    expect(data.draftStatus).toBe('PROCESSING')
    expect(data).not.toHaveProperty('audioKey')
    expect(data).not.toHaveProperty('isEnabled')
    expect(mocks.enqueueRenderAnnouncementTrim).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: 'original.wav',
        editorToken: response.json().renderToken,
      }),
    )
  })
  it('marks a failed enqueue recoverable without touching current audio', async () => {
    mocks.enqueueRenderAnnouncementTrim.mockRejectedValue(new Error('queue unavailable'))
    expect((await post('preview', settings)).statusCode).toBe(503)
    expect(mocks.announcementClip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { draftStatus: 'ERROR' } }),
    )
  })
  it('rejects stale, unrendered and removed target previews', async () => {
    expect((await post('apply', { ...apply, renderToken: 'stale' })).statusCode).toBe(409)
    mocks.sound.findFirst.mockResolvedValue(null)
    expect(
      (await post('apply', { ...apply, placement: 'AFTER', targetSoundId: 'removed' })).statusCode,
    ).toBe(400)
    expect(mocks.announcementClip.updateMany).not.toHaveBeenCalled()
  })
  it('atomically applies exactly the previewed render and chosen activation', async () => {
    expect((await post('apply', apply)).statusCode).toBe(200)
    expect(mocks.announcementClip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'clip', renderToken: 'token', draftStatus: 'READY' },
        data: expect.objectContaining({
          audioKey: 'preview.wav',
          isEnabled: true,
          renderToken: null,
          draftStatus: null,
        }),
      }),
    )
  })
})
