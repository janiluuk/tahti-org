// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../server.js'

vi.mock('../lib/minio.js', () => ({
  s3: { send: vi.fn().mockResolvedValue({}) },
}))

describe('M11 request-log plugin', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => app.close())

  it('echoes a client-supplied x-request-id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'corr-test-123' },
    })
    expect(res.headers['x-request-id'] ?? res.headers['X-Request-Id']).toBe('corr-test-123')
  })

  it('generates x-request-id when the header is absent', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    const id = res.headers['x-request-id'] ?? res.headers['X-Request-Id']
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})
