// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'

vi.mock('../config.js', () => ({ config: { appUrl: 'https://app.tahti.live' } }))
vi.mock('./minio.js', () => ({
  presignedGetUrl: vi.fn(async (key: string) => `https://cdn.example/${key}`),
}))
vi.mock('./public-media-url.js', () => ({
  publicMediaUrl: (key: string) => `https://media.example/${key}`,
}))

describe('resolvePublicLinkPage', () => {
  it('merges profile socials with own links and defaults five newest', async () => {
    const { resolvePublicLinkPage } = await import('./link-page.js')
    const sounds = Array.from({ length: 7 }, (_, i) => ({
      id: `s${i + 1}`,
      title: `Sound ${i + 1}`,
      durationSec: 60,
      bannerUrl: null,
      mp3Key: `s${i + 1}.mp3`,
      flacKey: null,
    }))
    const collections = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i + 1}`,
      slug: `set-${i + 1}`,
      name: `Set ${i + 1}`,
      coverUrl: null,
      coverKey: null,
      _count: { items: i + 1 },
    }))
    const page = await resolvePublicLinkPage({
      username: 'yaniho',
      socialLinks: { facebook: 'https://facebook.com/yaniho' },
      linkPageJson: {
        ownLinks: [{ id: 'o1', label: 'Linkr', url: 'https://linkr.bio/yaniho' }],
        soundIds: [],
        setIds: [],
        playMode: 'inline',
      },
      sounds,
      collections,
    })
    expect(page.siteUrl).toBe('https://yaniho.tahti.live')
    expect(page.linkPageUrl).toBe('https://tahti.live/u/yaniho')
    expect(page.links.map((l) => l.label)).toEqual(['Facebook', 'Linkr'])
    expect(page.sounds.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5'])
    expect(page.sets.map((s) => s.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
    expect(page.playMode).toBe('inline')
  })

  it('honours curated sound and set ids in order', async () => {
    const { resolvePublicLinkPage } = await import('./link-page.js')
    const page = await resolvePublicLinkPage({
      username: 'yaniho',
      socialLinks: null,
      linkPageJson: {
        ownLinks: [],
        soundIds: ['s3', 's1'],
        setIds: ['c2'],
        playMode: 'open',
      },
      sounds: [
        {
          id: 's1',
          title: 'A',
          durationSec: 1,
          bannerUrl: null,
          mp3Key: null,
          flacKey: null,
        },
        {
          id: 's3',
          title: 'C',
          durationSec: 1,
          bannerUrl: null,
          mp3Key: null,
          flacKey: null,
        },
      ],
      collections: [
        {
          id: 'c1',
          slug: 'one',
          name: 'One',
          coverUrl: null,
          coverKey: null,
          _count: { items: 1 },
        },
        {
          id: 'c2',
          slug: 'two',
          name: 'Two',
          coverUrl: null,
          coverKey: null,
          _count: { items: 2 },
        },
      ],
      playUrlBySoundId: new Map([
        ['s1', null],
        ['s3', null],
      ]),
    })
    expect(page.sounds.map((s) => s.id)).toEqual(['s3', 's1'])
    expect(page.sets.map((s) => s.id)).toEqual(['c2'])
    expect(page.playMode).toBe('open')
  })
})
