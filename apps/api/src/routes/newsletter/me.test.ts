// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'newsletter-me-test-'

describe('M13/M19 — newsletter drafts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'newsletter-me-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98530,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await prisma.newsletterDraft.deleteMany({
      where: { user: { email: { startsWith: PREFIX } } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a draft with subscribersOnly when requested', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: {
        subject: 'Fan-only update',
        bodyMd: 'Thanks for supporting!',
        subscribersOnly: true,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().subscribersOnly).toBe(true)
    expect(res.json().subject).toBe('Fan-only update')
  })

  it('defaults subscribersOnly to false', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: {
        subject: 'Everyone',
        bodyMd: 'Hello all subscribers',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().subscribersOnly).toBe(false)
  })

  it('rejects drafts without subject or body', async () => {
    const noSubject = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: { bodyMd: 'body only' },
    })
    expect(noSubject.statusCode).toBe(400)

    const noBody = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: { subject: 'subject only' },
    })
    expect(noBody.statusCode).toBe(400)
  })
})
