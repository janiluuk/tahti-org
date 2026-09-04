// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'channel-look-extras-'

const PLAYER_SCHEME = {
  bg: '#0B1220',
  accent: '#22D3EE',
  text: '#F8FAFC',
  muted: '#64748B',
  highlight: '#A78BFA',
}

describe('channel visual look extras', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  const username = 'channel-look-extras-artist'
  const slug = username

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98547,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
    vi.unstubAllGlobals()
  })

  it('PATCH sets usePlayerGradient + playerColorSchemeJson and GET returns them', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/visual',
      headers: { cookie },
      payload: {
        usePlayerGradient: true,
        playerColorSchemeJson: JSON.stringify(PLAYER_SCHEME),
        useBackgroundGradient: true,
        backgroundColorSchemeJson: JSON.stringify(PLAYER_SCHEME),
        backgroundVisualPreset: 'INTERACTIVE_POINTS',
        nowPlayingOverlayStyle: 'classic',
        nowPlayingOverlaySettingsJson: JSON.stringify({ density: 1 }),
        playerOverlayMode: 'GRADIENT_SHIMMER',
        playerOverlayText: 'On air',
        playerOverlayAlign: 'LEFT',
        channelLinks: [{ label: 'Bandcamp', url: 'https://example.bandcamp.com' }],
        brandAccentPreset: 'aurora',
      },
    })
    expect(patch.statusCode).toBe(200)
    const body = patch.json() as Record<string, unknown>
    expect(body.usePlayerGradient).toBe(true)
    expect(body.playerColorSchemeJson).toBe(JSON.stringify(PLAYER_SCHEME))
    expect(body.useBackgroundGradient).toBe(true)
    expect(body.backgroundVisualPreset).toBe('INTERACTIVE_POINTS')
    expect(body.nowPlayingOverlayStyle).toBe('classic')
    expect(body.playerOverlayMode).toBe('GRADIENT_SHIMMER')
    expect(body.playerOverlayText).toBe('On air')
    expect(body.playerOverlayAlign).toBe('LEFT')
    expect(body.brandAccentPreset).toBe('aurora')
    expect(JSON.parse(body.channelLinksJson as string)).toEqual([
      { label: 'Bandcamp', url: 'https://example.bandcamp.com' },
    ])

    const get = await app.inject({
      method: 'GET',
      url: '/api/me/channel/visual',
      headers: { cookie },
    })
    expect(get.statusCode).toBe(200)
    const got = get.json() as Record<string, unknown>
    expect(got.usePlayerGradient).toBe(true)
    expect(got.playerColorSchemeJson).toBe(JSON.stringify(PLAYER_SCHEME))
    expect(got.backgroundVisualPreset).toBe('INTERACTIVE_POINTS')
    expect(got.playerOverlayMode).toBe('GRADIENT_SHIMMER')
  })

  it('public channel and profile include look extras + brandAccentPreset', async () => {
    const publicChannel = await app.inject({
      method: 'GET',
      url: `/api/channels/${slug}`,
    })
    expect(publicChannel.statusCode).toBe(200)
    const channel = publicChannel.json() as Record<string, unknown>
    expect(channel.usePlayerGradient).toBe(true)
    expect(channel.playerColorSchemeJson).toBe(JSON.stringify(PLAYER_SCHEME))
    expect(channel.backgroundVisualPreset).toBe('INTERACTIVE_POINTS')
    expect(channel.nowPlayingOverlayStyle).toBe('classic')
    expect(channel.playerOverlayMode).toBe('GRADIENT_SHIMMER')
    expect(channel.playerOverlayText).toBe('On air')
    expect(channel.brandAccentPreset).toBe('aurora')
    expect(channel.channelLinksJson).toContain('Bandcamp')

    const profile = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${username}/profile`,
    })
    expect(profile.statusCode).toBe(200)
    const profileChannel = (profile.json() as { channel: Record<string, unknown> }).channel
    expect(profileChannel.usePlayerGradient).toBe(true)
    expect(profileChannel.playerColorSchemeJson).toBe(JSON.stringify(PLAYER_SCHEME))
    expect(profileChannel.brandAccentPreset).toBe('aurora')
    expect(profileChannel.playerOverlayMode).toBe('GRADIENT_SHIMMER')
    expect(profileChannel.channelLinksJson).toContain('Bandcamp')
  })
})
