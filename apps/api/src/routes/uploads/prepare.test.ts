// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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

const TEST_EMAIL_PREFIX = 'prepare-upload-test-'

describe('POST /api/uploads/prepare', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let sessionCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        passwordHash,
        username: 'prepare-upload-testuser',
        displayName: 'Prepare Upload Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'prepare-upload-testuser',
            liveSourceMount: '/live/prepare-upload-testuser',
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'dummyslug__dummykey',
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
      url: '/api/uploads/prepare',
      payload: {
        filename: 'track.mp3',
        contentType: 'audio/mpeg',
        fileSizeBytes: 1024 * 1024,
        title: 'My Track',
      },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for invalid contentType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/prepare',
      cookies: { tahti_session: sessionCookie },
      payload: {
        filename: 'track.mp3',
        contentType: 'video/mp4',
        fileSizeBytes: 1024 * 1024,
        title: 'My Track',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 200 with uploadId and uploadUrl for valid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/prepare',
      cookies: { tahti_session: sessionCookie },
      payload: {
        filename: 'track.mp3',
        contentType: 'audio/mpeg',
        fileSizeBytes: 1024 * 1024,
        title: 'My Track',
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.uploadId).toMatch(/^raw\/prepare-upload-testuser\//)
    expect(body.uploadUrl).toBe('https://minio.test/presigned')
    expect(body.expiresAt).toBeDefined()
  })
})
