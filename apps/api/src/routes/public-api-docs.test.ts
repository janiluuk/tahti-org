// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'

describe('Public API docs', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api serves Scalar HTML without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toContain('@scalar/api-reference')
    expect(res.body).toContain('/api/openapi.json')
  })

  it('GET /api/openapi.json is public OpenAPI 3 without admin paths', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/openapi.json' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.headers['access-control-allow-origin']).toBe('*')
    const body = res.json()
    expect(body.openapi).toMatch(/^3\./)
    expect(body.info?.title).toBe('Tahti API')
    expect(body.paths['/api/v1/channels']).toBeTruthy()
    expect(body.paths['/api/admin/stats']).toBeUndefined()
    expect(body.paths['/internal/rtmp/on_publish']).toBeUndefined()
    expect(body.paths['/metrics']).toBeUndefined()
  })
})
