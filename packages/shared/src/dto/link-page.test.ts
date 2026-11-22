// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'

import { parseLinkPageConfig, socialLinksForLinkPage } from './link-page.js'

describe('link-page', () => {
  it('defaults an empty config', () => {
    expect(parseLinkPageConfig(null)).toEqual({
      ownLinks: [],
      soundIds: [],
      setIds: [],
      playMode: 'inline',
    })
  })

  it('keeps curated ids and own links', () => {
    const parsed = parseLinkPageConfig({
      ownLinks: [{ id: 'a', label: 'Linkr', url: 'https://linkr.bio/x' }],
      soundIds: ['s1', 's2'],
      setIds: ['c1'],
      playMode: 'open',
    })
    expect(parsed.playMode).toBe('open')
    expect(parsed.ownLinks).toHaveLength(1)
    expect(parsed.soundIds).toEqual(['s1', 's2'])
  })

  it('maps profile social URLs and skips meta keys', () => {
    const links = socialLinksForLinkPage({
      website: 'https://example.com',
      instagram: 'https://instagram.com/x',
      genres: 'House',
      showConnections: '1',
      facebook: '',
    })
    expect(links.map((l) => l.key)).toEqual(['website', 'instagram'])
    expect(links.every((l) => l.source === 'profile')).toBe(true)
  })
})
