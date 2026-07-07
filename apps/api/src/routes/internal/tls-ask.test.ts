// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'tls-ask-test-'

describe('GET /internal/tls-ask', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'tls-ask-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98396,
    })
    await prisma.channel.update({
      where: { id: artist.channel!.id },
      data: { customDomain: 'radio.example.com', customDomainVerified: true },
    })

    const unverifiedArtist = await createTestArtist(prisma, {
      email: `${PREFIX}unverified@example.com`,
      username: 'tls-ask-unverified',
    })
    await prisma.channel.update({
      where: { id: unverifiedArtist.channel!.id },
      data: { customDomain: 'unverified.example.com', customDomainVerified: false },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects a missing domain param', async () => {
    const res = await app.inject({ method: 'GET', url: '/internal/tls-ask' })
    expect(res.statusCode).toBe(400)
  })

  it('allows a non-reserved *.tahti.live subdomain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/tls-ask?domain=some-artist.tahti.live',
    })
    expect(res.statusCode).toBe(200)
  })

  it('rejects a reserved *.tahti.live subdomain', async () => {
    const res = await app.inject({ method: 'GET', url: '/internal/tls-ask?domain=api.tahti.live' })
    expect(res.statusCode).toBe(403)
  })

  it('allows a non-reserved *.staging.tahti.live subdomain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/tls-ask?domain=some-artist.staging.tahti.live',
    })
    expect(res.statusCode).toBe(200)
  })

  it('rejects a reserved *.staging.tahti.live subdomain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/tls-ask?domain=chat.staging.tahti.live',
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a nested/multi-label tahti.live subdomain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/tls-ask?domain=evil.attacker.tahti.live',
    })
    expect(res.statusCode).toBe(403)
  })

  it('allows a verified custom domain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/tls-ask?domain=radio.example.com',
    })
    expect(res.statusCode).toBe(200)
  })

  it('rejects an unverified custom domain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/tls-ask?domain=unverified.example.com',
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a completely unknown domain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/tls-ask?domain=random-attacker-domain.com',
    })
    expect(res.statusCode).toBe(403)
  })
})
