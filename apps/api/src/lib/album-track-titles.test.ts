// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { prisma } from '@tahti/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanupUsersByEmailPrefix, createReadySound, createTestArtist } from '../test/helpers.js'
import {
  albumOrder,
  applyAlbumTrackTitles,
  backupFromPlan,
  planAlbumTrackTitles,
  restoreAlbumTrackTitles,
  type AlbumTrackTitleBackup,
} from './album-track-titles.js'

const EMAIL_PREFIX = 'album-titles-test-'
const USERNAME = 'albumtitlesyaniho'
const OTHER = 'albumtitlesother'
const KEEP = { createMissing: false }
const CREATE = { createMissing: true }

function addCollection(userId: string, slug: string, name: string) {
  return prisma.collection.create({
    data: { userId, slug, name, style: 'ALBUM', trackSortMode: 'MANUAL' },
  })
}

async function addItems(collectionId: string, items: Array<{ soundId: string; position: number }>) {
  for (const item of items) {
    await prisma.collectionItem.create({ data: { collectionId, ...item } })
  }
}

async function order(slug: string) {
  const items = await prisma.collectionItem.findMany({
    where: { collection: { slug } },
    orderBy: { position: 'asc' },
    select: { position: true, sound: { select: { title: true } } },
  })
  return items.map((item) => [item.position, item.sound?.title])
}

async function artists() {
  const artist = await createTestArtist(prisma, {
    email: `${EMAIL_PREFIX}artist@example.test`,
    username: USERNAME,
    displayName: 'Yaniho',
  })
  const other = await createTestArtist(prisma, {
    email: `${EMAIL_PREFIX}other@example.test`,
    username: OTHER,
    displayName: 'Other Artist',
  })
  return { artist, other, channelId: artist.channel!.id }
}

/** Uploads in the given order, a minute apart, so "newest" is well defined. */
async function uploads(channelId: string, titles: string[]) {
  const start = Date.UTC(2026, 0, 1)
  const sounds = []
  for (const [index, title] of titles.entries()) {
    const sound = await createReadySound(prisma, channelId, title)
    sounds.push(
      await prisma.sound.update({
        where: { id: sound.id },
        data: { createdAt: new Date(start + index * 60_000) },
      }),
    )
  }
  return sounds
}

async function seed() {
  const { artist, other, channelId } = await artists()
  const sound = (title: string) => createReadySound(prisma, channelId, title)

  const three = await sound('Yaniho - euphorizer LP - 03 - Three')
  const one = await sound('yaniho - Euphorizer LP - 01 - One')
  const guest = await createReadySound(
    prisma,
    other.channel!.id,
    'Other Artist - euphorizer LP - 02 - Guest',
  )
  const two = await sound('Yaniho – euphorizer LP – 2. Two')
  const bonus = await sound('Bonus jam')
  const four = await sound('Yaniho - euphorizer LP - 04 - Four')
  const nightB = await sound(`${USERNAME} - Night Drive EP - 2 - Highway`)
  const nightA = await sound('Yaniho - Night Drive EP - 1 - Ignition')
  const lost = await sound('Yaniho - Lost Tapes - 01 - Hidden')
  const plain = await sound('Yaniho - Something else')

  const euphorizer = await addCollection(artist.id, 'album-titles-euphorizer', 'euphorizer LP')
  await addItems(euphorizer.id, [
    { soundId: three.id, position: 1 },
    { soundId: one.id, position: 2 },
    { soundId: guest.id, position: 3 },
    { soundId: two.id, position: 4 },
    { soundId: bonus.id, position: 5 },
  ])
  const night = await addCollection(artist.id, 'album-titles-night', 'Night Drive EP')
  await addItems(night.id, [
    { soundId: nightB.id, position: 2 },
    { soundId: nightA.id, position: 5 },
  ])
  const favourites = await addCollection(artist.id, 'album-titles-favs', 'Favourites')
  await addItems(favourites.id, [
    { soundId: four.id, position: 1 },
    { soundId: plain.id, position: 2 },
  ])
  return { lost, four, plain, euphorizer }
}

const REVITALIZE = [
  'Tony McGuinness, Proff - Bolero (yaniho bootleg mix)',
  'Emma & Matilda - Ei kulu päivääkään (yaniho 12am mix, WIP)',
  'Yaniho, Acraze  - Revitalize LP - 02 - Do It To It (demo #1)',
  `Yaniho x G&D - Revitalize LP - 03 - You (yaniho "u no obiwan' mix)`,
  'Matti & Teppo - Untako vaan (Yaniho Xtended discomission mix)',
  'Yaniho - Revitalize LP - 05 - Lights out (yaniho remix)',
  'Yaniho, Velvet Girl - Revitalize LP - 06 - Promise U Heaven (demo 2)',
  'Ferry Corsten, Marsh - Attraction (Yaniho 2am mix)',
  'Yaniho, EANP - Revitalize LP - 08 - Center (yaniho no-ho mix)',
  'Yaniho - Revitalize LP - 09 - Dive (2024 edit)',
  'Yaniho x Chisu x Orkidea - Revitalize LP - 10 - Mysteeri Requiem (yaniho 2023 version, extended intro mix)',
  'Yaniho x Sono - Revitalize LP - 11 - Keep Control (yaniho 2024 update, demo 1)',
  'Yaniho, 3 monkeys, Alex Stein - Revitalize LP - 12 - Crazy Zz',
  'Yaniho x A&B - Revitalize LP - 13 -  Palermo (test pressing 1)',
  'Yaniho x Conjure1 - Revitalize LP - 14 - Tears from the moon (demo #1)',
  "Yaniho x Elekter - Revitalize LP - 15 - Grande Finale (yaniho 'funktion1' bootleg mix) [HELIHALL]",
  'Emma & Matilda - Ei kulu päivääkään (yaniho bootleg mix)',
  'Matti & Teppo - Untako vain (Yaniho discomission  mix)',
]

const REVITALIZE_CLEANED = [
  'Tony McGuinness, Proff - Bolero (yaniho bootleg mix)',
  'Emma & Matilda - Ei kulu päivääkään (yaniho 12am mix, WIP)',
  'Do It To It (demo #1) (with Acraze)',
  `You (yaniho "u no obiwan' mix) (with G&D)`,
  'Matti & Teppo - Untako vaan (Yaniho Xtended discomission mix)',
  'Lights out (yaniho remix)',
  'Promise U Heaven (demo 2) (with Velvet Girl)',
  'Ferry Corsten, Marsh - Attraction (Yaniho 2am mix)',
  'Center (yaniho no-ho mix) (with EANP)',
  'Dive (2024 edit)',
  'Mysteeri Requiem (yaniho 2023 version, extended intro mix) (with Chisu & Orkidea)',
  'Keep Control (yaniho 2024 update, demo 1) (with Sono)',
  'Crazy Zz (with 3 monkeys & Alex Stein)',
  'Palermo (test pressing 1) (with A&B)',
  'Tears from the moon (demo #1) (with Conjure1)',
  "Grande Finale (yaniho 'funktion1' bootleg mix) [HELIHALL] (with Elekter)",
  'Emma & Matilda - Ei kulu päivääkään (yaniho bootleg mix)',
  'Matti & Teppo - Untako vain (Yaniho discomission  mix)',
]

describe('albumOrder', () => {
  const sort = (numbers: Array<number | null>) =>
    albumOrder(
      numbers.map((number, index) => ({ number, index })),
      (item) => item.number,
    ).map((item) => (item.number === null ? `x${item.index}` : `${item.number}`))

  it('keeps an unnumbered item right after the item it follows now', () => {
    expect(sort([null, 3, null, 1, 2, null])).toEqual(['x0', '1', '2', 'x5', '3', 'x2'])
  })

  it('keeps the current order of repeated numbers', () => {
    expect(sort([2, 1, 2, null])).toEqual(['1', '2', '2', 'x3'])
  })
})

describe('album track titles', () => {
  beforeEach(async () => {
    await cleanupUsersByEmailPrefix(prisma, EMAIL_PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, EMAIL_PREFIX)
  })

  describe('small catalog', () => {
    let fixture: Awaited<ReturnType<typeof seed>>

    beforeEach(async () => {
      fixture = await seed()
    })

    it('plans renames and album order only for matching collections', async () => {
      const plan = await planAlbumTrackTitles(prisma, USERNAME)

      expect(plan.collections.map((collection) => collection.slug)).toEqual([
        'album-titles-euphorizer',
        'album-titles-night',
      ])
      const euphorizer = plan.collections[0]!
      expect(
        euphorizer.rows.map((row) => [
          row.oldPosition,
          row.newPosition,
          row.newTitle,
          row.trackNumber,
        ]),
      ).toEqual([
        [2, 1, 'One', 1],
        [3, 2, null, null],
        [4, 3, 'Two', 2],
        [5, 4, null, null],
        [1, 5, 'Three', 3],
      ])
      expect(euphorizer.warnings).toEqual([])

      expect(plan.strays).toEqual([
        expect.objectContaining({
          soundId: fixture.four.id,
          reason: 'not in "euphorizer LP" (album-titles-euphorizer), but in "Favourites"',
        }),
      ])
      expect(plan.newCollections).toEqual([
        {
          name: 'Lost Tapes',
          slug: `${USERNAME}-lost-tapes`,
          style: 'ALBUM',
          tracks: [
            {
              soundId: fixture.lost.id,
              oldTitle: 'Yaniho - Lost Tapes - 01 - Hidden',
              newTitle: 'Hidden',
              trackNumber: 1,
              position: 1,
            },
          ],
          duplicates: [],
          warnings: [],
        },
      ])
    })

    it('renames and renumbers 1..n, and a second run finds nothing', async () => {
      const plan = await planAlbumTrackTitles(prisma, USERNAME)
      const result = await applyAlbumTrackTitles(prisma, plan, KEEP)

      expect(result).toMatchObject({
        applied: ['album-titles-euphorizer', 'album-titles-night'],
        created: [],
        skipped: [],
      })
      expect(await order('album-titles-euphorizer')).toEqual([
        [1, 'One'],
        [2, 'Other Artist - euphorizer LP - 02 - Guest'],
        [3, 'Two'],
        [4, 'Bonus jam'],
        [5, 'Three'],
      ])
      expect(await order('album-titles-night')).toEqual([
        [1, 'Ignition'],
        [2, 'Highway'],
      ])
      expect(await order('album-titles-favs')).toEqual([
        [1, 'Yaniho - euphorizer LP - 04 - Four'],
        [2, 'Yaniho - Something else'],
      ])
      expect(await prisma.collection.count({ where: { name: 'Lost Tapes' } })).toBe(0)
      expect((await planAlbumTrackTitles(prisma, USERNAME)).collections).toEqual([])
    })

    it('skips a collection that changed after planning', async () => {
      const plan = await planAlbumTrackTitles(prisma, USERNAME)
      const bonus = await prisma.sound.findFirstOrThrow({ where: { title: 'Bonus jam' } })
      await prisma.collectionItem.deleteMany({ where: { soundId: bonus.id } })

      const result = await applyAlbumTrackTitles(prisma, plan, KEEP)

      expect(result.applied).toEqual(['album-titles-night'])
      expect(result.skipped).toEqual([
        { slug: 'album-titles-euphorizer', reason: 'items changed since the plan was made' },
      ])
      expect((await order('album-titles-euphorizer'))[0]).toEqual([
        1,
        'Yaniho - euphorizer LP - 03 - Three',
      ])
    })

    it('restores titles and positions, keeping titles edited since', async () => {
      const before = [await order('album-titles-euphorizer'), await order('album-titles-night')]
      const plan = await planAlbumTrackTitles(prisma, USERNAME)
      const backup = backupFromPlan(plan, KEEP)
      await applyAlbumTrackTitles(prisma, plan, KEEP)
      await prisma.sound.updateMany({ where: { title: 'Ignition' }, data: { title: 'Ignition!' } })

      const dryRun = await restoreAlbumTrackTitles(prisma, backup, { apply: false })
      expect(dryRun.titles).toHaveLength(4)
      expect(await order('album-titles-night')).toEqual([
        [1, 'Ignition!'],
        [2, 'Highway'],
      ])

      const restored = await restoreAlbumTrackTitles(prisma, backup, { apply: true })

      expect(restored.skipped).toEqual([expect.stringContaining('title is now "Ignition!", kept')])
      expect(await order('album-titles-euphorizer')).toEqual(before[0])
      expect(await order('album-titles-night')).toEqual([
        [2, `${USERNAME} - Night Drive EP - 2 - Highway`],
        [5, 'Ignition!'],
      ])
    })

    it('runs as a script: dry run writes a backup only, --apply and --restore write', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'album-titles-'))
      const backupFile = join(dir, 'backup.json')
      const run = (...args: string[]) =>
        promisify(execFile)(
          'pnpm',
          ['exec', 'tsx', resolve(__dirname, '../../scripts/clean-album-track-titles.ts'), ...args],
          { cwd: resolve(__dirname, '../..'), env: process.env },
        )
      try {
        const dry = await run(USERNAME, '--create-missing', '--backup', backupFile)
        expect(dry.stdout).toContain('2 -> 1    "yaniho - Euphorizer LP - 01 - One" -> "One" (#1)')
        expect(dry.stdout).toContain(`New ALBUM "Lost Tapes" (${USERNAME}-lost-tapes), private`)
        expect(dry.stdout).toContain(
          '  1         "Yaniho - Lost Tapes - 01 - Hidden" -> "Hidden" (#1)',
        )
        expect(dry.stdout).toContain('DRY RUN')
        const planned = JSON.parse(readFileSync(backupFile, 'utf8')) as AlbumTrackTitleBackup
        expect(planned.sounds).toHaveLength(6)
        expect(planned.createdCollections).toEqual([])
        expect((await order('album-titles-euphorizer'))[0]).toEqual([
          1,
          'Yaniho - euphorizer LP - 03 - Three',
        ])

        await run(USERNAME, '--create-missing', '--backup', backupFile, '--apply')
        expect((await order('album-titles-euphorizer'))[0]).toEqual([1, 'One'])
        expect(await order(`${USERNAME}-lost-tapes`)).toEqual([[1, 'Hidden']])
        const applied = JSON.parse(readFileSync(backupFile, 'utf8')) as AlbumTrackTitleBackup
        expect(applied.createdCollections).toEqual([
          expect.objectContaining({ slug: `${USERNAME}-lost-tapes`, name: 'Lost Tapes' }),
        ])

        const restore = await run('--restore', backupFile, '--apply')
        expect(restore.stdout).toContain(`delete collection ${USERNAME}-lost-tapes`)
        expect((await order('album-titles-euphorizer'))[0]).toEqual([
          1,
          'Yaniho - euphorizer LP - 03 - Three',
        ])
        expect(await prisma.collection.count({ where: { slug: `${USERNAME}-lost-tapes` } })).toBe(0)
        expect(await prisma.sound.findUniqueOrThrow({ where: { id: fixture.lost.id } })).toEqual(
          expect.objectContaining({ title: 'Yaniho - Lost Tapes - 01 - Hidden' }),
        )
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }, 60_000)
  })

  it('keeps the Revitalize LP order: unnumbered tracks stay next to their neighbours', async () => {
    const { artist, channelId } = await artists()
    const sounds = await uploads(channelId, REVITALIZE)
    const collection = await addCollection(artist.id, 'album-titles-revitalize', 'Revitalize LP')
    await addItems(
      collection.id,
      sounds.map((sound, index) => ({ soundId: sound.id, position: index + 1 })),
    )

    const plan = await planAlbumTrackTitles(prisma, USERNAME)

    expect(plan.collections).toHaveLength(1)
    expect(
      plan.collections[0]!.rows.map((row) => [row.oldPosition, row.newPosition, row.trackNumber]),
    ).toEqual([
      [1, 1, null],
      [2, 2, null],
      [3, 3, 2],
      [4, 4, 3],
      [5, 5, null],
      [6, 6, 5],
      [7, 7, 6],
      [8, 8, null],
      [9, 9, 8],
      [10, 10, 9],
      [11, 11, 10],
      [12, 12, 11],
      [13, 13, 12],
      [14, 14, 13],
      [15, 15, 14],
      [16, 16, 15],
      [17, 17, null],
      [18, 18, null],
    ])
    expect(plan.newCollections).toEqual([])
    expect(plan.strays).toEqual([])

    await applyAlbumTrackTitles(prisma, plan, CREATE)
    expect(await order('album-titles-revitalize')).toEqual(
      REVITALIZE_CLEANED.map((title, index) => [index + 1, title]),
    )
  })

  it('moves numbered tracks into place and takes their followers along', async () => {
    const { artist, channelId } = await artists()
    const titles = [
      REVITALIZE[0]!,
      REVITALIZE[9]!,
      REVITALIZE[2]!,
      REVITALIZE[7]!,
      REVITALIZE[5]!,
      REVITALIZE[16]!,
    ]
    const sounds = await uploads(channelId, titles)
    const collection = await addCollection(artist.id, 'album-titles-shuffled', 'Revitalize')
    await addItems(
      collection.id,
      sounds.map((sound, index) => ({ soundId: sound.id, position: index + 1 })),
    )

    await applyAlbumTrackTitles(prisma, await planAlbumTrackTitles(prisma, USERNAME), KEEP)

    expect(await order('album-titles-shuffled')).toEqual([
      [1, 'Tony McGuinness, Proff - Bolero (yaniho bootleg mix)'],
      [2, 'Do It To It (demo #1) (with Acraze)'],
      [3, 'Ferry Corsten, Marsh - Attraction (Yaniho 2am mix)'],
      [4, 'Lights out (yaniho remix)'],
      [5, 'Emma & Matilda - Ei kulu päivääkään (yaniho bootleg mix)'],
      [6, 'Dive (2024 edit)'],
    ])
  })

  it('treats LP and EP as the same album: "Sisufuzz EP - 07" belongs in "Sisufuzz LP"', async () => {
    const { artist, channelId } = await artists()
    const sounds = await uploads(channelId, [
      'Yaniho - Sisufuzz LP - 02 - Flux',
      'Yaniho - Sisufuzz LP - 04 -  Final countdown (decompression mix)',
      'Yaniho - Sisufuzz LP - 05 - All nite long (instrumental)',
      'Yaniho - Sisufuzz LP -  06 - Magwump',
      'Yaniho - Sisufuzz EP - 07 - Bring the spring',
      'Yaniho - Sisufuzz LP - 08 - Eclipse',
      'Yaniho - Deadc4t (extended mix)',
      'Yaniho - Sisufuzz LP - 10 - All dat she wants',
      'Yaniho - Sisufuzz LP - 11- Dive (2026 rework)',
      'Yaniho - Sisufuzz LP -  12 - Maybe baby (wip demo)',
      'Yaniho - All nite Long (chillout dub version)',
      'Yaniho - U wont',
      'Yaniho - Sisufuzz LP - 05 - All nite long (instrumental)',
    ])
    const collection = await addCollection(artist.id, 'album-titles-sisufuzz', 'Sisufuzz LP')
    await addItems(
      collection.id,
      sounds.slice(0, 12).map((sound, index) => ({ soundId: sound.id, position: index + 1 })),
    )

    const plan = await planAlbumTrackTitles(prisma, USERNAME)
    await applyAlbumTrackTitles(prisma, plan, CREATE)

    expect(await order('album-titles-sisufuzz')).toEqual([
      [1, 'Flux'],
      [2, 'Final countdown (decompression mix)'],
      [3, 'All nite long (instrumental)'],
      [4, 'Magwump'],
      [5, 'Bring the spring'],
      [6, 'Eclipse'],
      [7, 'Yaniho - Deadc4t (extended mix)'],
      [8, 'All dat she wants'],
      [9, 'Dive (2026 rework)'],
      [10, 'Maybe baby (wip demo)'],
      [11, 'Yaniho - All nite Long (chillout dub version)'],
      [12, 'Yaniho - U wont'],
    ])
    expect(plan.newCollections).toEqual([])
    expect(plan.strays).toEqual([
      {
        soundId: sounds[12]!.id,
        title: 'Yaniho - Sisufuzz LP - 05 - All nite long (instrumental)',
        albumName: 'Sisufuzz LP',
        reason: 'not in "Sisufuzz LP" (album-titles-sisufuzz)',
      },
    ])
  })

  it('makes a private album per missing album, in track order, newest of a duplicate only', async () => {
    const { artist, channelId } = await artists()
    const sounds = await uploads(channelId, [
      'Yaniho - Euphorizer LP - 17 - Hysterizer',
      'Yaniho - Euphorizer LP - 03 - Particular Particle',
      'Yaniho - Euphorizer LP -  02 - Sad Guinneapig',
      'Yaniho - Descension LP - 05 - Oceanic',
      'Yaniho - Euphorizer LP - 10  - Home (test pressing #1)',
      'Yaniho - Euphorizer LP - 17 - Hysterizer',
      'Yaniho - Euphorizer LP - 14 - Bit Blue (dub,  demo #3)',
      'yaniho - Night Moves EP - 01 - Intro',
      'Yaniho, Acraze - euphorizer LP - 04 - Until the sky falls on us (demo #1)',
      'Yaniho - Something else',
    ])
    const playlist = await addCollection(artist.id, 'album-titles-faves', 'Faves')
    await addItems(playlist.id, [{ soundId: sounds[2]!.id, position: 1 }])

    const plan = await planAlbumTrackTitles(prisma, USERNAME)

    expect(plan.collections).toEqual([])
    expect(plan.strays).toEqual([])
    expect(
      plan.newCollections.map((collection) => ({
        name: collection.name,
        slug: collection.slug,
        style: collection.style,
        tracks: collection.tracks.map((track) => [track.position, track.newTitle, track.soundId]),
        duplicates: collection.duplicates,
      })),
    ).toEqual([
      {
        name: 'Euphorizer LP',
        slug: `${USERNAME}-euphorizer-lp`,
        style: 'ALBUM',
        tracks: [
          [1, 'Sad Guinneapig', sounds[2]!.id],
          [2, 'Particular Particle', sounds[1]!.id],
          [3, 'Until the sky falls on us (demo #1) (with Acraze)', sounds[8]!.id],
          [4, 'Home (test pressing #1)', sounds[4]!.id],
          [5, 'Bit Blue (dub, demo #3)', sounds[6]!.id],
          [6, 'Hysterizer', sounds[5]!.id],
        ],
        duplicates: [
          {
            soundId: sounds[0]!.id,
            title: 'Yaniho - Euphorizer LP - 17 - Hysterizer',
            keptSoundId: sounds[5]!.id,
          },
        ],
      },
      {
        name: 'Descension LP',
        slug: `${USERNAME}-descension-lp`,
        style: 'ALBUM',
        tracks: [[1, 'Oceanic', sounds[3]!.id]],
        duplicates: [],
      },
      {
        name: 'Night Moves EP',
        slug: `${USERNAME}-night-moves-ep`,
        style: 'EP',
        tracks: [[1, 'Intro', sounds[7]!.id]],
        duplicates: [],
      },
    ])

    const result = await applyAlbumTrackTitles(prisma, plan, CREATE)
    await result.settled

    expect(result.created.map((created) => created.slug)).toEqual([
      `${USERNAME}-euphorizer-lp`,
      `${USERNAME}-descension-lp`,
      `${USERNAME}-night-moves-ep`,
    ])
    const euphorizer = await prisma.collection.findUniqueOrThrow({
      where: { slug: `${USERNAME}-euphorizer-lp` },
    })
    expect(euphorizer).toMatchObject({
      userId: artist.id,
      name: 'Euphorizer LP',
      style: 'ALBUM',
      isPublic: false,
      visibility: 'DRAFT',
      trackSortMode: 'MANUAL',
    })
    expect(await order(`${USERNAME}-euphorizer-lp`)).toEqual([
      [1, 'Sad Guinneapig'],
      [2, 'Particular Particle'],
      [3, 'Until the sky falls on us (demo #1) (with Acraze)'],
      [4, 'Home (test pressing #1)'],
      [5, 'Bit Blue (dub, demo #3)'],
      [6, 'Hysterizer'],
    ])
    expect(await order('album-titles-faves')).toEqual([[1, 'Sad Guinneapig']])
    expect(await prisma.sound.findUniqueOrThrow({ where: { id: sounds[0]!.id } })).toMatchObject({
      title: 'Yaniho - Euphorizer LP - 17 - Hysterizer',
    })

    const again = await planAlbumTrackTitles(prisma, USERNAME)
    expect(again.collections).toEqual([])
    expect(again.newCollections).toEqual([])
    expect(again.strays).toEqual([
      expect.objectContaining({
        soundId: sounds[0]!.id,
        reason: `not in "Euphorizer LP" (${USERNAME}-euphorizer-lp)`,
      }),
    ])
  })

  it('restore deletes the albums it made unless something was added since', async () => {
    const { artist, channelId } = await artists()
    const sounds = await uploads(channelId, [
      'Yaniho - Euphorizer LP - 02 - Sad Guinneapig',
      'Yaniho - Euphorizer LP - 03 - Particular Particle',
      'Yaniho - Descension LP - 05 - Oceanic',
      'Yaniho - Something else',
    ])
    const plan = await planAlbumTrackTitles(prisma, USERNAME)
    const backup = backupFromPlan(plan, CREATE)
    const result = await applyAlbumTrackTitles(prisma, plan, {
      ...CREATE,
      onCreated: (created) => backup.createdCollections!.push(created),
    })
    expect(backup.createdCollections!.map((created) => created.slug)).toEqual([
      `${USERNAME}-euphorizer-lp`,
      `${USERNAME}-descension-lp`,
    ])
    const descension = result.created[1]!
    await prisma.collectionItem.create({
      data: { collectionId: descension.id, soundId: sounds[3]!.id, position: 2 },
    })
    await prisma.collectionItem.deleteMany({
      where: { collection: { slug: `${USERNAME}-euphorizer-lp` }, position: 1 },
    })

    const dryRun = await restoreAlbumTrackTitles(prisma, backup, { apply: false })
    expect(dryRun.deleted.map((deleted) => deleted.slug)).toEqual([`${USERNAME}-euphorizer-lp`])
    expect(await prisma.collection.count({ where: { userId: artist.id } })).toBe(2)

    const restored = await restoreAlbumTrackTitles(prisma, backup, { apply: true })

    expect(restored.titles).toHaveLength(3)
    expect(restored.skipped).toEqual([
      `collection ${USERNAME}-descension-lp: has items added since, kept`,
    ])
    expect(
      await prisma.collection.findMany({ where: { userId: artist.id }, select: { slug: true } }),
    ).toEqual([{ slug: `${USERNAME}-descension-lp` }])
    expect(
      (await prisma.sound.findMany({ where: { channelId }, orderBy: { createdAt: 'asc' } })).map(
        (sound) => sound.title,
      ),
    ).toEqual([
      'Yaniho - Euphorizer LP - 02 - Sad Guinneapig',
      'Yaniho - Euphorizer LP - 03 - Particular Particle',
      'Yaniho - Descension LP - 05 - Oceanic',
      'Yaniho - Something else',
    ])
  })
})
