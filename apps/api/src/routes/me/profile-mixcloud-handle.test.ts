// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'profile-mixcloud-handle-'

describe('PATCH /api/me/profile — Mixcloud handle', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'profile-mixcloud-handle',
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const patchLinks = (socialLinks: Record<string, string>) =>
    app.inject({
      method: 'PATCH',
      url: '/api/me/profile',
      headers: { cookie },
      payload: { socialLinks },
    })

  const storedHandle = async () =>
    (await prisma.user.findUnique({ where: { id: userId }, select: { mixcloudUsername: true } }))
      ?.mixcloudUsername

  it('stores the handle from a Mixcloud profile URL', async () => {
    const res = await patchLinks({ mixcloud: 'https://www.mixcloud.com/sunday-selector/' })
    expect(res.statusCode).toBe(200)
    expect(await storedHandle()).toBe('sunday-selector')
  })

  it('accepts a bare handle', async () => {
    await patchLinks({ mixcloud: 'night_drive' })
    expect(await storedHandle()).toBe('night_drive')
  })

  it('clears the handle when the link is emptied', async () => {
    await patchLinks({ mixcloud: '' })
    expect(await storedHandle()).toBeNull()
  })

  it('keeps the handle when other links change', async () => {
    await patchLinks({ mixcloud: 'night_drive' })
    await patchLinks({ website: 'https://example.com' })
    expect(await storedHandle()).toBe('night_drive')
  })
})
