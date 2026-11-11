// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const { enqueueTranscode } = vi.hoisted(() => ({
  enqueueTranscode: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/queue.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/queue.js')>()),
  enqueueTranscode,
}))

import { buildApp } from '../../server.js'
import { STALE_PENDING_RETRY_AFTER_MS } from './sound-retry-processing.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-retry-proc-test-'
const REASON = 'The file is not a supported audio format, or it is damaged.'

describe('failed sound processing', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'sound-retry-artist',
      tier: 'ARTIST',
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'sound-retry-other',
      tier: 'ARTIST',
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  beforeEach(() => {
    enqueueTranscode.mockClear()
  })

  async function failedSound() {
    const sound = await createReadySound(prisma, channelId, 'Broken upload')
    return prisma.sound.update({
      where: { id: sound.id },
      data: { status: 'ERROR', processingError: REASON },
    })
  }

  it('returns the failure reason for a watched id and on the owner view', async () => {
    const sound = await failedSound()
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/sound/processing?ids=${sound.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().settled).toEqual([{ id: sound.id, status: 'ERROR', processingError: REASON }])

    const view = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${sound.id}`,
      headers: { cookie },
    })
    expect(view.json().processingError).toBe(REASON)
  })

  it('queues processing again and clears the reason', async () => {
    const sound = await failedSound()
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/retry-processing`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: sound.id, status: 'PENDING' })
    expect(enqueueTranscode).toHaveBeenCalledWith(sound.id)
    const stored = await prisma.sound.findUnique({
      where: { id: sound.id },
      select: { status: true, processingError: true },
    })
    expect(stored).toEqual({ status: 'PENDING', processingError: null })

    const again = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/retry-processing`,
      headers: { cookie },
    })
    expect(again.statusCode).toBe(409)
    expect(enqueueTranscode).toHaveBeenCalledTimes(1)
  })

  async function pendingSound(updatedAgoMs: number) {
    const sound = await createReadySound(prisma, channelId, 'Stalled upload')
    await prisma.sound.update({
      where: { id: sound.id },
      data: { status: 'PENDING', mp3Key: null },
    })
    // updatedAt is @updatedAt, so backdate it with raw SQL.
    await prisma.$executeRaw`UPDATE "channel"."Sound" SET "updatedAt" = ${new Date(
      Date.now() - updatedAgoMs,
    )} WHERE id = ${sound.id}`
    return sound
  }

  it('re-queues a sound stuck PENDING for over 30 minutes, once', async () => {
    const sound = await pendingSound(STALE_PENDING_RETRY_AFTER_MS + 60_000)
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/retry-processing`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: sound.id, status: 'PENDING' })
    expect(enqueueTranscode).toHaveBeenCalledWith(sound.id)

    const again = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/retry-processing`,
      headers: { cookie },
    })
    expect(again.statusCode).toBe(409)
    expect(enqueueTranscode).toHaveBeenCalledTimes(1)
  })

  it('refuses a sound that only just went PENDING', async () => {
    const sound = await pendingSound(60_000)
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/retry-processing`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(enqueueTranscode).not.toHaveBeenCalled()
  })

  it('refuses a stale PENDING sound with no uploaded file', async () => {
    const sound = await pendingSound(STALE_PENDING_RETRY_AFTER_MS + 60_000)
    await prisma.$executeRaw`UPDATE "channel"."Sound" SET "rawKey" = NULL WHERE id = ${sound.id}`
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/retry-processing`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(enqueueTranscode).not.toHaveBeenCalled()
  })

  it('refuses a sound that did not fail', async () => {
    const sound = await createReadySound(prisma, channelId, 'Fine upload')
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/retry-processing`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(enqueueTranscode).not.toHaveBeenCalled()
  })

  it("does not let another artist retry someone else's sound", async () => {
    const sound = await failedSound()
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/retry-processing`,
      headers: { cookie: otherCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(enqueueTranscode).not.toHaveBeenCalled()
  })

  it('requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/whatever/retry-processing',
    })
    expect(res.statusCode).toBe(401)
  })
})
