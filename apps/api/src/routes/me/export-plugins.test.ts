// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ExportPluginProviderListSchema } from '@tahti/shared'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'
import { config } from '../../config.js'

const PREFIX = 'export-plugins-'

describe('GET /api/me/export-plugins', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'export-plugins-user',
    })
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/export-plugins' })
    expect(res.statusCode).toBe(401)
  })

  it('returns the versioned export provider catalog including revelator', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/export-plugins',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = ExportPluginProviderListSchema.parse(res.json())
    const revelator = body.providers.find((provider) => provider.id === 'revelator')
    expect(revelator?.capabilities.submit).toBe(true)
    expect(revelator?.submitPath).toBe('/api/me/releases/:id/revelator/submit')
    expect(revelator?.webhookPath).toBe('/api/webhooks/export/revelator')
  })
})

describe('POST /api/webhooks/export/:provider', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects missing auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/export/revelator',
      payload: { event: 'status' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('accepts INTERNAL_SECRET and acks known providers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/export/revelator',
      headers: { authorization: `Bearer ${config.internalSecret}` },
      payload: { event: 'status', releaseId: 'rel_stub' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, provider: 'revelator', accepted: true })
  })
})
