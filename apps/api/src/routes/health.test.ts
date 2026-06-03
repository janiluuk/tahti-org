// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../server.js'

vi.mock('../lib/minio.js', () => ({
  s3: { send: vi.fn().mockResolvedValue({}) },
}))

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns health payload with dependency checks', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect([200, 503]).toContain(response.statusCode)
    const body = response.json()
    if (response.statusCode === 200) {
      expect(['ok', 'degraded']).toContain(body.status)
      expect(body.db).toBe('ok')
    } else {
      expect(body.status).toBe('error')
      expect(body.db).toBe('error')
    }
    expect(body.checks).toHaveProperty('postgres')
    expect(body.checks).toHaveProperty('redis')
    expect(body.checks).toHaveProperty('minio')
    expect(typeof body.uptime).toBe('number')
  })

  it('includes Source-Code header', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.headers['source-code']).toContain('tahti')
  })
})

describe('GET /source', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('redirects to the source repo', async () => {
    const response = await app.inject({ method: 'GET', url: '/source' })
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBeDefined()
  })
})
