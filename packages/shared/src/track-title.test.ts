// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  parseAlbumTrackTitle,
  splitAlbumTrackTitle,
  trackTitleFromFilename,
} from './track-title.js'

describe('trackTitleFromFilename', () => {
  it.each([
    ['01 Midnight Run.mp3', 'Midnight Run'],
    ['01. Midnight Run.mp3', 'Midnight Run'],
    ['1 - Midnight Run.flac', 'Midnight Run'],
    ['12) Midnight Run.wav', 'Midnight Run'],
    ['03_Midnight_Run.wav', 'Midnight Run'],
    ['Midnight Run (1).mp3', 'Midnight Run'],
    ['Midnight Run [www.example.com].mp3', 'Midnight Run'],
    ['C:\\music\\Midnight Run.flac', 'Midnight Run'],
  ])('cleans %s', (filename, title) => {
    expect(trackTitleFromFilename(filename)).toBe(title)
  })

  it('drops the uploader’s own name in either order with the track number', () => {
    const artistNames = ['DJ Example', 'djexample']
    expect(trackTitleFromFilename('DJ Example - Midnight Run.mp3', { artistNames })).toBe(
      'Midnight Run',
    )
    expect(trackTitleFromFilename('02 - djexample - Midnight Run.mp3', { artistNames })).toBe(
      'Midnight Run',
    )
    expect(trackTitleFromFilename('dj example - 04 - Midnight Run.mp3', { artistNames })).toBe(
      'Midnight Run',
    )
  })

  it('keeps names that only look like leftovers', () => {
    expect(trackTitleFromFilename('99 Luftballons.mp3')).toBe('99 Luftballons')
    expect(trackTitleFromFilename('1999.mp3')).toBe('1999')
    expect(trackTitleFromFilename('Live 10.7.26')).toBe('Live 10.7.26')
    expect(trackTitleFromFilename('Other Artist - Midnight Run.mp3')).toBe(
      'Other Artist - Midnight Run',
    )
    expect(trackTitleFromFilename('1-800 Call.mp3')).toBe('1-800 Call')
  })

  it('falls back to the file name when cleaning leaves nothing', () => {
    expect(trackTitleFromFilename('01.mp3')).toBe('01')
    expect(trackTitleFromFilename('.wav')).toBe('')
  })
})

describe('parseAlbumTrackTitle', () => {
  const options = { artistNames: ['yaniho', 'Yaniho'], albumName: 'euphorizer LP' }

  it.each([
    ['yaniho - euphorizer LP - 02 - Particular particle', 'Particular particle', 2],
    ['Yaniho - Euphorizer LP - 02 - Particular particle', 'Particular particle', 2],
    ['YANIHO - EUPHORIZER lp - 10 - Loud', 'Loud', 10],
    ['euphorizer LP - 02 - Particular particle', 'Particular particle', 2],
    ['yaniho – euphorizer LP – 3 – Wave', 'Wave', 3],
    ['yaniho — euphorizer LP — 03 — Wave', 'Wave', 3],
    ['  yaniho  -   euphorizer   LP  -  04  -   Wide   gap  ', 'Wide gap', 4],
    ['yaniho - euphorizer LP - 05. Dotted', 'Dotted', 5],
    ['yaniho - euphorizer LP - 05. - Dotted dash', 'Dotted dash', 5],
    ['yaniho-euphorizer LP-06 - Tight', 'Tight', 6],
    ['yaniho - euphorizer LP - 101 - Long album', 'Long album', 101],
    ['yaniho - euphorizer LP - 07 - Part 1 - Intro', 'Part 1 - Intro', 7],
    ['yaniho - euphorizer LP - 08 - 99 Luftballons', '99 Luftballons', 8],
  ])('parses %s', (input, title, trackNumber) => {
    expect(parseAlbumTrackTitle(input, options)).toEqual({ title, trackNumber })
  })

  it('matches album names written with other dashes or spacing', () => {
    expect(
      parseAlbumTrackTitle('yaniho - Live – Helsinki - 01 - Opener', {
        artistNames: ['yaniho'],
        albumName: 'Live - Helsinki',
      }),
    ).toEqual({ title: 'Opener', trackNumber: 1 })
  })

  it('reads a self-titled album with or without the artist part', () => {
    const selfTitled = { artistNames: ['yaniho'], albumName: 'yaniho' }
    expect(parseAlbumTrackTitle('yaniho - 01 - First', selfTitled)).toEqual({
      title: 'First',
      trackNumber: 1,
    })
    expect(parseAlbumTrackTitle('yaniho - yaniho - 02 - Second', selfTitled)).toEqual({
      title: 'Second',
      trackNumber: 2,
    })
  })

  it('treats album names as text, not patterns', () => {
    expect(
      parseAlbumTrackTitle('yaniho - Hits (Vol. 1) - 04 - Track', {
        artistNames: ['yaniho'],
        albumName: 'Hits (Vol. 1)',
      }),
    ).toEqual({ title: 'Track', trackNumber: 4 })
    expect(
      parseAlbumTrackTitle('yaniho - Hits XVol. 1) - 04 - Track', {
        artistNames: ['yaniho'],
        albumName: 'Hits (Vol. 1)',
      }),
    ).toBeNull()
  })

  it.each([
    ['Particular particle'],
    ['yaniho - Particular particle'],
    ['yaniho - other LP - 02 - Particular particle'],
    ['someone else - euphorizer LP - 02 - Particular particle'],
    ['yaniho - euphorizer LP - Particular particle'],
    ['yaniho - euphorizer LPs - 02 - Particular particle'],
    ['yaniho - euphorizer - 02 - Particular particle'],
    ['yaniho - euphorizer LP - 2-Step Groove'],
    ['yaniho - euphorizer LP - 1999 - Party'],
    ['yaniho - euphorizer LP - 00 - Zero'],
    ['yaniho - euphorizer LP - 02 - '],
    ['yaniho - euphorizer LP - 02'],
    ['yaniho - euphorizer LP - 02 Particular particle'],
    ['Remix of yaniho - euphorizer LP - 02 - Particular particle'],
    ['euphorizer LP (Remastered) - 02 - Particular particle'],
  ])('leaves %s alone', (input) => {
    expect(parseAlbumTrackTitle(input, options)).toBeNull()
  })

  it('needs an album name', () => {
    expect(
      parseAlbumTrackTitle('yaniho - 02 - Particular particle', {
        artistNames: ['yaniho'],
        albumName: '  ',
      }),
    ).toBeNull()
  })

  it('works without artist names', () => {
    expect(
      parseAlbumTrackTitle('euphorizer LP - 09 - Closer', {
        artistNames: [],
        albumName: 'euphorizer LP',
      }),
    ).toEqual({ title: 'Closer', trackNumber: 9 })
  })
})

describe('splitAlbumTrackTitle', () => {
  const options = { artistNames: ['yaniho'] }

  it('finds the album and number after the artist', () => {
    expect(
      splitAlbumTrackTitle('Yaniho - euphorizer  LP - 02 - Particular particle', options),
    ).toEqual({ albumName: 'euphorizer LP', title: 'Particular particle', trackNumber: 2 })
    expect(splitAlbumTrackTitle('yaniho - 2-Step EP - 03. Groove', options)).toEqual({
      albumName: '2-Step EP',
      title: 'Groove',
      trackNumber: 3,
    })
  })

  it.each([
    ['euphorizer LP - 02 - Particular particle'],
    ['yaniho - Particular particle'],
    ['yaniho - euphorizer LP - Particular particle'],
    ['someone else - euphorizer LP - 02 - Particular particle'],
  ])('leaves %s alone', (input) => {
    expect(splitAlbumTrackTitle(input, options)).toBeNull()
  })

  it('needs an artist name', () => {
    expect(splitAlbumTrackTitle('yaniho - euphorizer LP - 02 - X', { artistNames: [] })).toBeNull()
  })
})
