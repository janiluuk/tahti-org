// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchText } = vi.hoisted(() => ({ fetchText: vi.fn() }))
vi.mock('../lib/music-feeds.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/music-feeds.js')>()),
  fetchText,
}))

import { processImportMusicNewsJob } from './import-music-news.js'

const item = (n: number) => `<item><title>Story ${n}</title>
<link>https://news.example/${n}</link><guid>g-${n}</guid>
<pubDate>Mon, 23 Nov 2026 10:00:00 +0000</pubDate>
<description>Excerpt ${n}</description></item>`
const feed = (...ns: number[]) =>
  `<rss version="2.0"><channel>${ns.map(item).join('')}</channel></rss>`

const findMany = vi.fn()
const create = vi.fn()
const prisma = { newsPost: { findMany, create } } as never
const SOURCES = [
  { key: 'a', name: 'Alpha', feedUrl: 'https://a.example/feed/' },
  { key: 'b', name: 'Beta', feedUrl: 'https://b.example/feed/' },
]

describe('processImportMusicNewsJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('adds new stories as unpublished drafts and skips known ones', async () => {
    fetchText.mockResolvedValueOnce(feed(1, 2)).mockResolvedValueOnce(feed(3))
    findMany.mockResolvedValueOnce([{ externalId: 'g-1' }]).mockResolvedValueOnce([])

    const result = await processImportMusicNewsJob(prisma, SOURCES)

    expect(result).toEqual({ imported: 2, skipped: 1, failedSources: [] })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        headline: 'Story 2',
        summary: 'Excerpt 2',
        linkUrl: 'https://news.example/2',
        linkLabel: 'Read on Alpha',
        authorName: 'Alpha',
        sourceKey: 'a',
        externalId: 'g-2',
        publishedAt: null,
      }),
    })
  })

  it('keeps going when one feed fails and reports it', async () => {
    fetchText.mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValueOnce(feed(3))
    findMany.mockResolvedValue([])

    const result = await processImportMusicNewsJob(prisma, SOURCES)

    expect(result).toEqual({ imported: 1, skipped: 0, failedSources: ['a'] })
  })
})
