// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'stash-share-test-'

describe('POST /api/me/stash/:id/share', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let fileId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const file = await prisma.stashFile.create({
      data: {
        userId: artist.id,
        filename: 'demo.wav',
        objectKey: `stash/${artist.id}/demo.wav`,
        contentType: 'audio/wav',
        sizeBytes: BigInt(1024),
      },
    })
    fileId = file.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const share = (payload: unknown) =>
    app.inject({
      method: 'POST',
      url: `/api/me/stash/${fileId}/share`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    })

  it('creates a share with a known permission', async () => {
    const res = await share({ permission: 'DOWNLOAD', granteeUsername: 'friend', expiresInDays: 7 })
    expect(res.statusCode).toBe(201)
    expect(res.json().permission).toBe('DOWNLOAD')
    expect(res.json().expiresAt).not.toBeNull()
  })

  it('defaults to READ with no expiry', async () => {
    const res = await share({})
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ permission: 'READ', expiresAt: null })
  })

  it.each([
    ['an unknown permission', { permission: 'ADMIN' }],
    ['a non-string permission', { permission: 5 }],
    ['a non-numeric expiry', { expiresInDays: 'soon' }],
    ['a negative expiry', { expiresInDays: -1 }],
    ['a fractional expiry', { expiresInDays: 1.5 }],
    ['a non-string grantee', { granteeUsername: 42 }],
  ])('rejects %s with 400 and stores nothing', async (_label, payload) => {
    const before = await prisma.stashShare.count({ where: { fileId } })
    const res = await share(payload)
    expect(res.statusCode).toBe(400)
    expect(await prisma.stashShare.count({ where: { fileId } })).toBe(before)
  })
})
