// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { config } from '../../config.js'

describe('export provider webhooks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const bearer = `Bearer ${config.internalSecret}`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects unauthenticated callbacks', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/export/revelator',
      payload: { event: 'delivery.completed' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects unknown providers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/export/does-not-exist',
      headers: { authorization: bearer },
      payload: {},
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects providers without webhook capability', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/export/spotify',
      headers: { authorization: bearer },
      payload: {},
    })
    expect(res.statusCode).toBe(404)
  })

  it('accepts revelator callbacks via bearer auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/export/revelator',
      headers: { authorization: bearer },
      payload: { event: 'delivery.completed', releaseId: 'rel_123' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, provider: 'revelator', accepted: true })
  })

  it('accepts revelator callbacks via webhook-secret header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/export/revelator',
      headers: { 'x-tahti-webhook-secret': config.internalSecret },
      payload: { event: 'delivery.completed' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ provider: 'revelator', accepted: true })
  })
})
