// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'

import { MUSIC_NEWS_SOURCES, parseRssEntries, plainExcerpt } from './music-feeds.js'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Konekellari</title>
<item>
  <title>THREEJAYS &#8211; Bedroom Beats #22</title>
  <link>https://konekellari.fi/2026/11/bedroom-beats-22/</link>
  <guid isPermaLink="false">https://konekellari.fi/?p=123</guid>
  <pubDate>Sun, 22 Nov 2026 23:00:00 +0000</pubDate>
  <description><![CDATA[<p>DEEP TECHNO. Tämänkertainen <b>Bedroom Beats</b> jakso&hellip;</p><p>The post THREEJAYS appeared first on Konekellari.</p>]]></description>
</item>
<item><title>No link</title></item>
</channel></rss>`

describe('parseRssEntries', () => {
  it('reads title, link, guid, date and a plain excerpt', () => {
    const [entry, ...rest] = parseRssEntries(RSS)
    expect(rest).toHaveLength(0)
    expect(entry).toEqual({
      externalId: 'https://konekellari.fi/?p=123',
      title: 'THREEJAYS – Bedroom Beats #22',
      link: 'https://konekellari.fi/2026/11/bedroom-beats-22/',
      excerpt: 'DEEP TECHNO. Tämänkertainen Bedroom Beats jakso…',
      publishedAt: new Date('2026-11-22T23:00:00Z'),
    })
  })

  it('returns nothing for a document that is not RSS', () => {
    expect(parseRssEntries('<html><body>nope</body></html>')).toEqual([])
  })
})

describe('plainExcerpt', () => {
  it('cuts long text on a word boundary with an ellipsis', () => {
    const text = plainExcerpt(`<p>${'sana '.repeat(100)}</p>`, 40)
    expect(text.length).toBeLessThanOrEqual(40)
    expect(text.endsWith('…')).toBe(true)
    expect(text).not.toMatch(/san…$/)
  })
})

describe('MUSIC_NEWS_SOURCES', () => {
  it('lists the approved feeds over https with unique keys', () => {
    expect(MUSIC_NEWS_SOURCES.map((s) => s.key)).toEqual([
      'konekellari',
      'soundi',
      'rumba',
      'inferno',
      'kaaoszine',
    ])
    expect(MUSIC_NEWS_SOURCES.every((s) => s.feedUrl.startsWith('https://'))).toBe(true)
  })
})
