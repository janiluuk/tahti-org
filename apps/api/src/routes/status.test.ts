// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../server.js'

vi.mock('../lib/minio.js', () => ({
  s3: { send: vi.fn().mockResolvedValue({}) },
}))

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
    expect(body.checks.postgres).toMatchObject({ state: expect.any(String), critical: true })
    expect(body.checks.redis).toMatchObject({ state: expect.any(String), critical: true })
    expect(body.checks.minio).toMatchObject({ state: expect.any(String), critical: true })
    expect(body).toHaveProperty('uptimeSec')
  })
})

describe('GET /metrics', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => app.close())

  it('returns prometheus text', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.body).toContain('tahti_dependency_up{dependency="postgres"}')
    expect(res.body).toContain('tahti_api_uptime_seconds')
    expect(res.body).toContain('tahti_users_registered_total')
    expect(res.body).toContain('tahti_http_requests_total')
  })
})
