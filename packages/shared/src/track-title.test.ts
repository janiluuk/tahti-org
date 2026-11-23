// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  albumKey,
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

describe('album titles from the yaniho import', () => {
  const artistNames = ['yaniho', 'Yaniho']

  it.each([
    [
      "Don't Turn Away From Love LP",
      "Don't Turn Away From Love LP - 04 - David Bowie - I'm deranged (yaniho vocal mix)",
      "David Bowie - I'm deranged (yaniho vocal mix)",
      4,
    ],
    ['Sisufuzz LP', 'Yaniho - Sisufuzz LP - 02 - Flux', 'Flux', 2],
    [
      'Sisufuzz LP',
      'Yaniho - Sisufuzz LP - 04 -  Final countdown (decompression mix)',
      'Final countdown (decompression mix)',
      4,
    ],
    [
      'Sisufuzz LP',
      'Yaniho - Sisufuzz LP - 05 - All nite long (instrumental)',
      'All nite long (instrumental)',
      5,
    ],
    ['Sisufuzz LP', 'Yaniho - Sisufuzz LP -  06 - Magwump', 'Magwump', 6],
    ['Sisufuzz LP', 'Yaniho - Sisufuzz EP - 07 - Bring the spring', 'Bring the spring', 7],
    ['Sisufuzz LP', 'Yaniho - Sisufuzz LP - 08 - Eclipse', 'Eclipse', 8],
    ['Sisufuzz LP', 'Yaniho - Sisufuzz LP - 10 - All dat she wants', 'All dat she wants', 10],
    ['Sisufuzz LP', 'Yaniho - Sisufuzz LP - 11- Dive (2026 rework)', 'Dive (2026 rework)', 11],
    [
      'Sisufuzz LP',
      'Yaniho - Sisufuzz LP -  12 - Maybe baby (wip demo)',
      'Maybe baby (wip demo)',
      12,
    ],
    [
      'Revitalize LP',
      'Yaniho, Acraze  - Revitalize LP - 02 - Do It To It (demo #1)',
      'Do It To It (demo #1) (with Acraze)',
      2,
    ],
    [
      'Revitalize LP',
      `Yaniho x G&D - Revitalize LP - 03 - You (yaniho "u no obiwan' mix)`,
      `You (yaniho "u no obiwan' mix) (with G&D)`,
      3,
    ],
    [
      'Revitalize LP',
      'Yaniho - Revitalize LP - 05 - Lights out (yaniho remix)',
      'Lights out (yaniho remix)',
      5,
    ],
    [
      'Revitalize LP',
      'Yaniho, Velvet Girl - Revitalize LP - 06 - Promise U Heaven (demo 2)',
      'Promise U Heaven (demo 2) (with Velvet Girl)',
      6,
    ],
    [
      'Revitalize LP',
      'Yaniho, EANP - Revitalize LP - 08 - Center (yaniho no-ho mix)',
      'Center (yaniho no-ho mix) (with EANP)',
      8,
    ],
    ['Revitalize LP', 'Yaniho - Revitalize LP - 09 - Dive (2024 edit)', 'Dive (2024 edit)', 9],
    [
      'Revitalize LP',
      'Yaniho x Chisu x Orkidea - Revitalize LP - 10 - Mysteeri Requiem (yaniho 2023 version, extended intro mix)',
      'Mysteeri Requiem (yaniho 2023 version, extended intro mix) (with Chisu & Orkidea)',
      10,
    ],
    [
      'Revitalize LP',
      'Yaniho x Sono - Revitalize LP - 11 - Keep Control (yaniho 2024 update, demo 1)',
      'Keep Control (yaniho 2024 update, demo 1) (with Sono)',
      11,
    ],
    [
      'Revitalize LP',
      'Yaniho, 3 monkeys, Alex Stein - Revitalize LP - 12 - Crazy Zz',
      'Crazy Zz (with 3 monkeys & Alex Stein)',
      12,
    ],
    [
      'Revitalize LP',
      'Yaniho x A&B - Revitalize LP - 13 -  Palermo (test pressing 1)',
      'Palermo (test pressing 1) (with A&B)',
      13,
    ],
    [
      'Revitalize LP',
      'Yaniho x Conjure1 - Revitalize LP - 14 - Tears from the moon (demo #1)',
      'Tears from the moon (demo #1) (with Conjure1)',
      14,
    ],
    [
      'Revitalize LP',
      "Yaniho x Elekter - Revitalize LP - 15 - Grande Finale (yaniho 'funktion1' bootleg mix) [HELIHALL]",
      "Grande Finale (yaniho 'funktion1' bootleg mix) [HELIHALL] (with Elekter)",
      15,
    ],
  ])('reads "%s" track %s', (albumName, input, title, trackNumber) => {
    expect(parseAlbumTrackTitle(input, { artistNames, albumName })).toEqual({ title, trackNumber })
  })

  it.each([
    ['Sisufuzz LP', 'Yaniho - Deadc4t (extended mix)'],
    ['Sisufuzz LP', 'Yaniho - All nite Long (chillout dub version)'],
    ['Sisufuzz LP', 'Yaniho - U wont'],
    ['Sisufuzz LP', 'Yaniho - Breeze (5am mix)'],
    ['Sisufuzz LP', 'Yaniho - All nite Long'],
    ['Sisufuzz LP', 'Yaniho - Deadc4t'],
    ['Revitalize LP', 'Tony McGuinness, Proff - Bolero (yaniho bootleg mix)'],
    ['Revitalize LP', 'Emma & Matilda - Ei kulu päivääkään (yaniho 12am mix, WIP)'],
    ['Revitalize LP', 'Matti & Teppo - Untako vaan (Yaniho Xtended discomission mix)'],
    ['Revitalize LP', 'Ferry Corsten, Marsh - Attraction (Yaniho 2am mix)'],
    ['Revitalize LP', 'Emma & Matilda - Ei kulu päivääkään (yaniho bootleg mix)'],
    ['Revitalize LP', 'Matti & Teppo - Untako vain (Yaniho discomission  mix)'],
  ])('leaves "%s" item %s alone', (albumName, input) => {
    expect(parseAlbumTrackTitle(input, { artistNames, albumName })).toBeNull()
  })

  it.each([
    ['Yaniho - Euphorizer LP -  02 - Sad Guinneapig', 'Euphorizer LP', 'Sad Guinneapig', 2],
    [
      'Yaniho - Euphorizer LP - 03 - Particular Particle',
      'Euphorizer LP',
      'Particular Particle',
      3,
    ],
    [
      'Yaniho - Euphorizer LP - 04 - Until the sky falls on us (demo #1)',
      'Euphorizer LP',
      'Until the sky falls on us (demo #1)',
      4,
    ],
    [
      'Yaniho - Euphorizer LP - 05 - The world wont care',
      'Euphorizer LP',
      'The world wont care',
      5,
    ],
    [
      'Yaniho - Euphorizer LP - 06 - Tripadvisor (testpressing #1)',
      'Euphorizer LP',
      'Tripadvisor (testpressing #1)',
      6,
    ],
    ['Yaniho - Euphorizer LP - 07 - Hundparken', 'Euphorizer LP', 'Hundparken', 7],
    ['Yaniho - Euphorizer LP - 08 - Veiled Descent', 'Euphorizer LP', 'Veiled Descent', 8],
    ['Yaniho - Euphorizer LP - 09 - Ketaseta', 'Euphorizer LP', 'Ketaseta', 9],
    [
      'Yaniho - Euphorizer LP - 10  - Home (test pressing #1)',
      'Euphorizer LP',
      'Home (test pressing #1)',
      10,
    ],
    ['Yaniho - Euphorizer LP - 13 - Never Nuff', 'Euphorizer LP', 'Never Nuff', 13],
    [
      'Yaniho - Euphorizer LP - 14 - Bit Blue (dub,  demo #3)',
      'Euphorizer LP',
      'Bit Blue (dub, demo #3)',
      14,
    ],
    ['Yaniho - Euphorizer LP - 15 - Breeze (12am mix)', 'Euphorizer LP', 'Breeze (12am mix)', 15],
    ['Yaniho - Euphorizer LP - 17 - Hysterizer', 'Euphorizer LP', 'Hysterizer', 17],
    ['Yaniho - Descension LP - 05 - Oceanic', 'Descension LP', 'Oceanic', 5],
    ['Yaniho - Sisufuzz EP - 07 - Bring the spring', 'Sisufuzz EP', 'Bring the spring', 7],
    [
      'yaniho - euphorizer LP - 02 - Particular particle',
      'euphorizer LP',
      'Particular particle',
      2,
    ],
    [
      'Yaniho, Acraze  - Revitalize LP - 02 - Do It To It (demo #1)',
      'Revitalize LP',
      'Do It To It (demo #1) (with Acraze)',
      2,
    ],
    [
      'Yaniho, 3 monkeys, Alex Stein - Revitalize LP - 12 - Crazy Zz',
      'Revitalize LP',
      'Crazy Zz (with 3 monkeys & Alex Stein)',
      12,
    ],
  ])('splits %s', (input, albumName, title, trackNumber) => {
    expect(splitAlbumTrackTitle(input, { artistNames })).toEqual({ albumName, title, trackNumber })
  })

  it.each([
    ["Don't Turn Away From Love LP - 04 - David Bowie - I'm deranged (yaniho vocal mix)"],
    ['Tony McGuinness, Proff - Bolero (yaniho bootleg mix)'],
    ['Matti & Teppo - Untako vaan (Yaniho Xtended discomission mix)'],
    ['Yaniho - Deadc4t (extended mix)'],
  ])('does not split %s', (input) => {
    expect(splitAlbumTrackTitle(input, { artistNames })).toBeNull()
  })
})

describe('collaborator credits', () => {
  const options = { artistNames: ['yaniho'], albumName: 'Revitalize LP' }
  const parse = (input: string) => parseAlbumTrackTitle(input, options)?.title ?? null

  it.each([
    ['yaniho feat. MC Foo - Revitalize LP - 01 - Song', 'Song (with MC Foo)'],
    ['yaniho ft. MC Foo - Revitalize LP - 01 - Song', 'Song (with MC Foo)'],
    ['yaniho FEAT MC Foo - Revitalize LP - 01 - Song', 'Song (with MC Foo)'],
    ['yaniho vs Bar - Revitalize LP - 01 - Song', 'Song (with Bar)'],
    ['yaniho & Bar - Revitalize LP - 01 - Song', 'Song (with Bar)'],
    ['Acraze x YANIHO - Revitalize LP - 01 - Song', 'Song (with Acraze)'],
    ['Acraze, yaniho, Bar - Revitalize LP - 01 - Song', 'Song (with Acraze & Bar)'],
    ['yaniho x A x B x C - Revitalize LP - 01 - Song', 'Song (with A, B & C)'],
    ['Jay-Z x yaniho - Revitalize LP - 01 - Song', 'Song (with Jay-Z)'],
  ])('reads %s', (input, title) => {
    expect(parse(input)).toBe(title)
  })

  it('does not repeat a name the title already has', () => {
    expect(parse('yaniho x Sono - Revitalize LP - 11 - Keep Control (Sono remix)')).toBe(
      'Keep Control (Sono remix)',
    )
    expect(parse('yaniho x Chisu x Orkidea - Revitalize LP - 10 - Song (chisu edit)')).toBe(
      'Song (chisu edit) (with Orkidea)',
    )
  })

  it.each([
    ['Acraze - Revitalize LP - 02 - Do It To It'],
    ['Acraze x G&D - Revitalize LP - 02 - Do It To It'],
    ['yanihox - Revitalize LP - 02 - Do It To It'],
    ['yaniho and Bar - Revitalize LP - 02 - Song'],
  ])('leaves %s alone: the credit does not name the artist', (input) => {
    expect(parse(input)).toBeNull()
    expect(splitAlbumTrackTitle(input, options)).toBeNull()
  })
})

describe('LP and EP', () => {
  const artistNames = ['yaniho']

  it.each([
    ['Sisufuzz LP', 'yaniho - Sisufuzz EP - 07 - X'],
    ['Sisufuzz LP', 'yaniho - Sisufuzz - 07 - X'],
    ['Sisufuzz', 'yaniho - Sisufuzz LP - 07 - X'],
    ['Sisufuzz EP', 'yaniho - sisufuzz  lp - 07 - X'],
  ])('album "%s" takes %s', (albumName, input) => {
    expect(parseAlbumTrackTitle(input, { artistNames, albumName })).toEqual({
      title: 'X',
      trackNumber: 7,
    })
  })

  it.each([
    ['Sisufuzz LP', 'yaniho - Sisufuzz 2 LP - 07 - X'],
    ['Sisufuzz LP', 'yaniho - Sisufuzz LPs - 07 - X'],
    ['Sisufuzz LP', 'yaniho - Sisufuzz CD - 07 - X'],
    ['Sisufuzz 2 LP', 'yaniho - Sisufuzz LP - 07 - X'],
  ])('album "%s" does not take %s', (albumName, input) => {
    expect(parseAlbumTrackTitle(input, { artistNames, albumName })).toBeNull()
  })

  it('compares album names by their base name', () => {
    expect(albumKey('Sisufuzz EP')).toBe(albumKey(' sisufuzz   LP'))
    expect(albumKey('Sisufuzz')).toBe(albumKey('Sisufuzz LP'))
    expect(albumKey('Live – Helsinki')).toBe(albumKey('live - helsinki ep'))
    expect(albumKey('Sisufuzz 2 LP')).not.toBe(albumKey('Sisufuzz LP'))
    expect(albumKey('EP')).toBe('ep')
  })
})
