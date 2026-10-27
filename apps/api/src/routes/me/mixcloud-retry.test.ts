// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const add = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('../../lib/queue.js', () => ({ mediaQueue: { add } }))

const PREFIX = 'mixcloud-retry-'

describe('Retrying a failed Mixcloud upload', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let itemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    await prisma.user.update({
      where: { id: artist.id },
      data: { mixcloudAccessTokenEnc: 'enc-token' },
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    itemId = (await createReadySound(prisma, artist.channel!.id, 'Retry mix')).id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const post = () =>
    app.inject({ method: 'POST', url: `/api/me/sound/${itemId}/mixcloud`, headers: { cookie } })

  it('queues the same upload again after it failed, but not while it is pending or done', async () => {
    expect((await post()).statusCode).toBe(202)
    const first = await prisma.mixUpload.findUniqueOrThrow({ where: { soundId: itemId } })
    expect((await post()).statusCode).toBe(409)

    await prisma.mixUpload.update({
      where: { id: first.id },
      data: { status: 'FAILED', error: 'Mixcloud said no', completedAt: new Date() },
    })
    add.mockClear()
    const retried = await post()
    expect(retried.statusCode).toBe(202)
    expect(retried.json().mixUploadId).toBe(first.id)
    expect(add).toHaveBeenCalledWith('mixcloud-upload', { mixUploadId: first.id })
    const after = await prisma.mixUpload.findUniqueOrThrow({ where: { id: first.id } })
    expect(after).toMatchObject({ status: 'PENDING', error: null, completedAt: null })

    await prisma.mixUpload.update({ where: { id: first.id }, data: { status: 'DONE' } })
    expect((await post()).statusCode).toBe(409)
  })
})
