// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import cors from './cors.js'

vi.mock('../config.js', () => ({ config: { isProd: true, appUrl: 'https://app.tahti.live' } }))

describe('Desktop production CORS', () => {
  it('allows exact native origins for credentialed requests and preflights', async () => {
    const app = Fastify()
    await app.register(cors)
    app.get('/probe', async () => ({ ok: true }))
    try {
      for (const origin of [
        'tauri://localhost',
        'http://tauri.localhost',
        'https://tauri.localhost',
      ]) {
        for (const method of ['GET', 'OPTIONS'] as const) {
          const response = await app.inject({ method, url: '/probe', headers: { origin } })
          expect(response.headers['access-control-allow-origin']).toBe(origin)
          expect(response.headers['access-control-allow-credentials']).toBe('true')
          expect(response.statusCode).toBe(method === 'GET' ? 200 : 204)
        }
      }
      for (const origin of [
        'http://localhost:5173',
        'tauri://evil',
        'https://tauri.localhost.evil.example',
      ]) {
        const response = await app.inject({ method: 'GET', url: '/probe', headers: { origin } })
        expect(response.headers['access-control-allow-origin']).toBeUndefined()
      }
    } finally {
      await app.close()
    }
  })
})
