// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'

describe('GET /api/v1/status', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => app.close())

  it('returns operational or degraded with dependency checks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/status' })
    expect([200, 503]).toContain(res.statusCode)
    const body = res.json()
    expect(body.checks).toHaveProperty('database')
    expect(body.checks).toHaveProperty('redis')
    expect(body).toHaveProperty('uptimeSec')
  })
})
