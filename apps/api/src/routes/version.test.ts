// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../server.js'

describe('GET /api/version', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => app.close())

  it('returns the running release version without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/version' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ version: expect.any(String) })
  })
})
