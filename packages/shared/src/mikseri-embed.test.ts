// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { mikseriTrackEmbedUrl } from './mikseri-embed.js'

describe('mikseriTrackEmbedUrl', () => {
  it('normalizes track ids, track pages, and official track embeds', () => {
    const expected = 'https://www.mikseri.net/embed/?type=1&parameter=635878'
    expect(mikseriTrackEmbedUrl('635878')).toBe(expected)
    expect(mikseriTrackEmbedUrl('https://www.mikseri.net/artists/example/song/635878/')).toBe(
      expected,
    )
    expect(mikseriTrackEmbedUrl('https://mikseri.net/embed/?type=1&parameter=635878')).toBe(
      expected,
    )
  })

  it('rejects artist pages, playlists, charts, and unrelated hosts for track imports', () => {
    expect(mikseriTrackEmbedUrl('https://www.mikseri.net/artists/example.121009.php')).toBeNull()
    expect(mikseriTrackEmbedUrl('https://www.mikseri.net/artists/example.121009')).toBeNull()
    expect(mikseriTrackEmbedUrl('https://www.mikseri.net/artists/?id=145802')).toBeNull()
    expect(mikseriTrackEmbedUrl('https://www.mikseri.net/music/635878')).toBeNull()
    expect(mikseriTrackEmbedUrl('https://mikseri.net/embed/?type=2&parameter=1')).toBeNull()
    expect(mikseriTrackEmbedUrl('https://example.com/song.635878')).toBeNull()
  })
})
