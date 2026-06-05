// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  openApiRedirectResponse,
  openApiResponse,
  openApiResponses,
  zodOpenApiComponents,
} from './openapi-zod.js'

describe('openApiRedirectResponse', () => {
  it('returns null body schema for redirect status codes', () => {
    expect(openApiRedirectResponse(302)).toEqual({ 302: { type: 'null' } })
    expect(openApiRedirectResponse(301)).toEqual({ 301: { type: 'null' } })
  })
})

describe('openApiResponse', () => {
  it('wraps a Zod schema as a 200 OpenAPI response', () => {
    const schema = z.object({ ok: z.boolean() })
    const out = openApiResponse(schema, 'OkBody')
    expect(out[200]).toBeTruthy()
    expect(JSON.stringify(out[200])).toContain('ok')
  })
})

describe('openApiResponses', () => {
  it('maps multiple status codes', () => {
    const a = z.object({ id: z.string() })
    const b = z.object({ error: z.string() })
    const out = openApiResponses([
      { status: 201, schema: a, name: 'Created' },
      { status: 400, schema: b, name: 'BadRequest' },
    ])
    expect(out[201]).toBeTruthy()
    expect(out[400]).toBeTruthy()
    expect(JSON.stringify(out[400])).toContain('error')
  })
})

describe('zodOpenApiComponents', () => {
  it('registers named component schemas', () => {
    const components = zodOpenApiComponents({
      Ping: z.object({ pong: z.literal(true) }),
    })
    expect(components.Ping).toBeTruthy()
    expect(JSON.stringify(components.Ping)).toContain('pong')
  })
})
