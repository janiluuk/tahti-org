// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Readable } from 'node:stream'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

vi.mock('../../lib/minio.js', () => ({
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/presigned'),
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/get'),
  getObjectStream: vi.fn().mockResolvedValue({
    body: Readable.from([Buffer.from('fake-image-bytes')]),
    contentType: 'image/jpeg',
    contentLength: 17,
  }),
  s3: {},
}))

const TEST_EMAIL_PREFIX = 'press-kit-images-test-'
const USERNAME = 'press-kit-images-testuser'

describe('press kit images', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let sessionCookie: string
  let otherSessionCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        passwordHash,
        username: USERNAME,
        displayName: 'Press Kit Images Test',
        bio: 'Making beats since forever.',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: USERNAME,
            liveSourceMount: `/live/${USERNAME}`,
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'dummyslug__dummykey',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}other@example.com`,
        passwordHash,
        username: `${USERNAME}-other`,
        displayName: 'Other User',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      },
    })

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}user@example.com`, password: 'testpassword' },
    })
    sessionCookie = loginRes.cookies.find((c) => c.name === 'tahti_session')!.value

    const otherLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}other@example.com`, password: 'testpassword' },
    })
    otherSessionCookie = otherLoginRes.cookies.find((c) => c.name === 'tahti_session')!.value
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/press-kit/images' })
    expect(res.statusCode).toBe(401)
  })

  it('404s prepare for a user with no channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/press-kit/images/prepare',
      cookies: { tahti_session: otherSessionCookie },
      payload: { filename: 'photo.jpg', contentType: 'image/jpeg' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('prepares an upload with a channel-scoped key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/press-kit/images/prepare',
      cookies: { tahti_session: sessionCookie },
      payload: { filename: 'photo.jpg', contentType: 'image/jpeg' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.uploadKey).toMatch(new RegExp(`^press-kit/${USERNAME}/`))
    expect(body.uploadUrl).toBe('https://minio.test/presigned')
  })

  it('rejects completing an upload key that belongs to another channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/press-kit/images/complete',
      cookies: { tahti_session: sessionCookie },
      payload: { uploadKey: 'press-kit/someone-else/photo.jpg' },
    })
    expect(res.statusCode).toBe(403)
  })

  let imageId: string

  it('completes an upload and creates the image row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/press-kit/images/complete',
      cookies: { tahti_session: sessionCookie },
      payload: { uploadKey: `press-kit/${USERNAME}/photo1.jpg`, title: 'Backstage' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.title).toBe('Backstage')
    expect(body.includeInZip).toBe(true)
    expect(body.position).toBe(0)
    imageId = body.id
  })

  it('lists images for the owner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/press-kit/images',
      cookies: { tahti_session: sessionCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(imageId)
  })

  it('forbids another user from patching someone else’s image', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/press-kit/images/${imageId}`,
      cookies: { tahti_session: otherSessionCookie },
      payload: { title: 'Hijacked' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('patches title and includeInZip', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/press-kit/images/${imageId}`,
      cookies: { tahti_session: sessionCookie },
      payload: { title: 'Main promo shot', includeInZip: false },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.title).toBe('Main promo shot')
    expect(body.includeInZip).toBe(false)
  })

  it('gallery is private and empty until opted in', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${USERNAME}/press-kit-images.json`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('gets and patches gallery settings', async () => {
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/me/press-kit/gallery-settings',
      cookies: { tahti_session: sessionCookie },
    })
    expect(getRes.json()).toEqual({ pressKitGalleryPublic: false })

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/me/press-kit/gallery-settings',
      cookies: { tahti_session: sessionCookie },
      payload: { pressKitGalleryPublic: true },
    })
    expect(patchRes.statusCode).toBe(200)
    expect(patchRes.json()).toEqual({ pressKitGalleryPublic: true })
  })

  it('publishes the gallery once opted in', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${USERNAME}/press-kit-images.json`,
    })
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ id: imageId, title: 'Main promo shot' })
    expect(body[0].imageUrl).toBeTruthy()
  })

  it('downloads a press-kit zip with bio.txt, excluding images unchecked for zip', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${USERNAME}/press-kit.zip`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/zip')
    expect(res.headers['content-disposition']).toContain(`${USERNAME}-press-kit.zip`)
    expect(res.rawPayload.length).toBeGreaterThan(0)
  })

  it('deletes an image', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/press-kit/images/${imageId}`,
      cookies: { tahti_session: sessionCookie },
    })
    expect(res.statusCode).toBe(204)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/me/press-kit/images',
      cookies: { tahti_session: sessionCookie },
    })
    expect(listRes.json()).toEqual([])
  })
})
