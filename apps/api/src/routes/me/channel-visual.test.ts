// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { DEFAULT_COLOR_SCHEME } from '@tahti/shared'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'channel-visual-route-'

describe('PATCH /api/me/channel/visual — backdrop fields', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'channel-visual-route-user',
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET starts with the backdrop disabled and no preset', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/visual',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.useBackgroundGradient).toBe(false)
    expect(body.backgroundVisualPreset).toBeNull()
    expect(body.backgroundVisualSettingsJson).toBeNull()
  })

  it('PATCH persists useBackgroundGradient, backgroundVisualPreset, and settings', async () => {
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/visual',
      headers: { cookie },
      payload: {
        useBackgroundGradient: true,
        backgroundColorSchemeJson: JSON.stringify(DEFAULT_COLOR_SCHEME),
        backgroundVisualPreset: 'BLOOM',
        backgroundVisualSettings: { BLOOM: { speed: 1.5, intensity: 0.8, audioReactive: true } },
      },
    })
    expect(patchRes.statusCode).toBe(200)
    const body = patchRes.json()
    expect(body.useBackgroundGradient).toBe(true)
    expect(body.backgroundVisualPreset).toBe('BLOOM')
    expect(JSON.parse(body.backgroundVisualSettingsJson)).toEqual({
      BLOOM: { speed: 1.5, intensity: 0.8, audioReactive: true },
    })

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/me/channel/visual',
      headers: { cookie },
    })
    expect(getRes.json().backgroundVisualPreset).toBe('BLOOM')
  })

  it('PATCH clears backgroundVisualSettings when set to null', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/visual',
      headers: { cookie },
      payload: { backgroundVisualSettings: null },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().backgroundVisualSettingsJson).toBeNull()
  })

  it('rejects an unknown backgroundVisualPreset id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/visual',
      headers: { cookie },
      payload: { backgroundVisualPreset: 'NOT_A_REAL_PRESET' },
    })
    expect(res.statusCode).toBe(400)
  })
})
