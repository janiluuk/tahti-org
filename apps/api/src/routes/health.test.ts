// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 200 with status ok when DB is connected', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
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
