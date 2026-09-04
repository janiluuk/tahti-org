// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { parseFeedItems } from './rss-feed.js'

describe('parseFeedItems', () => {
  it('parses RSS 2.0 items', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Studio Log</title>
  <item>
    <title>New EP out now</title>
    <link>https://example.com/ep</link>
    <pubDate>Mon, 01 Sep 2026 12:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Show announced</title>
    <link>https://example.com/show</link>
  </item>
</channel></rss>`

    expect(parseFeedItems(xml)).toEqual([
      {
        title: 'New EP out now',
        link: 'https://example.com/ep',
        pubDate: 'Mon, 01 Sep 2026 12:00:00 GMT',
      },
      { title: 'Show announced', link: 'https://example.com/show', pubDate: null },
    ])
  })

  it('parses Atom entries, preferring the non-self link', () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Studio Log</title>
  <entry>
    <title>New EP out now</title>
    <link rel="self" href="https://example.com/feed.xml"/>
    <link rel="alternate" href="https://example.com/ep"/>
    <updated>2026-09-01T12:00:00Z</updated>
  </entry>
</feed>`

    expect(parseFeedItems(xml)).toEqual([
      { title: 'New EP out now', link: 'https://example.com/ep', pubDate: '2026-09-01T12:00:00Z' },
    ])
  })

  it('drops entries missing a title or link', () => {
    const xml = `<rss><channel>
      <item><title>No link here</title></item>
      <item><link>https://example.com/only-link</link></item>
    </channel></rss>`
    expect(parseFeedItems(xml)).toEqual([])
  })

  it('caps at the given limit', () => {
    const items = Array.from(
      { length: 12 },
      (_, i) => `<item><title>Item ${i}</title><link>https://example.com/${i}</link></item>`,
    ).join('')
    const xml = `<rss><channel>${items}</channel></rss>`
    expect(parseFeedItems(xml, 8)).toHaveLength(8)
  })

  it('returns an empty list for malformed input instead of throwing', () => {
    expect(parseFeedItems('not xml at all <<<')).toEqual([])
    expect(parseFeedItems('<rss><channel></channel></rss>')).toEqual([])
  })
})
