// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

vi.mock('../../lib/minio.js', () => ({
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/presigned'),
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/get'),
  s3: {},
}))

vi.mock('../../lib/queue.js', () => ({
  enqueueTranscode: vi.fn().mockResolvedValue(undefined),
  mediaQueue: {},
}))

const TEST_EMAIL_PREFIX = 'complete-upload-test-'

describe('POST /api/uploads/complete', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let sessionCookie: string
  let channelSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    channelSlug = 'complete-upload-testuser'
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        passwordHash,
        username: channelSlug,
        displayName: 'Complete Upload Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: channelSlug,
            liveSourceMount: `/live/${channelSlug}`,
            liveSourcePassHash: 'dummy',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}user@example.com`, password: 'testpassword' },
    })
    const cookie = loginRes.cookies.find((c) => c.name === 'tahti_session')
    sessionCookie = cookie!.value
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/complete',
      payload: {
        uploadId: `raw/${channelSlug}/abc123.mp3`,
        etag: 'etag123',
        title: 'My Track',
      },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 for upload from another channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/complete',
      cookies: { tahti_session: sessionCookie },
      payload: {
        uploadId: 'raw/other-channel/abc123.mp3',
        etag: 'etag123',
        title: 'My Track',
      },
    })
    expect(res.statusCode).toBe(403)
  })

  it('creates ArchiveItem and enqueues job', async () => {
    const uploadId = `raw/${channelSlug}/validfile.mp3`
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/complete',
      cookies: { tahti_session: sessionCookie },
      payload: { uploadId, etag: 'etag123', title: 'Test Track' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.itemId).toBeDefined()
    expect(body.status).toBe('pending')

    const item = await prisma.archiveItem.findUnique({ where: { id: body.itemId } })
    expect(item).not.toBeNull()
    expect(item!.title).toBe('Test Track')
    expect(item!.status).toBe('PENDING')
  })
})
