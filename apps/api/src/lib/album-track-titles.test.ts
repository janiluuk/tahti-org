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
  applyAlbumTrackTitles,
  backupFromPlan,
  planAlbumTrackTitles,
  restoreAlbumTrackTitles,
  type AlbumTrackTitleBackup,
} from './album-track-titles.js'

const EMAIL_PREFIX = 'album-titles-test-'
const USERNAME = 'albumtitlesyaniho'
const OTHER = 'albumtitlesother'

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

async function seed() {
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
  const channelId = artist.channel!.id
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

describe('album track titles', () => {
  let fixture: Awaited<ReturnType<typeof seed>>

  beforeEach(async () => {
    await cleanupUsersByEmailPrefix(prisma, EMAIL_PREFIX)
    fixture = await seed()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, EMAIL_PREFIX)
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
      [4, 2, 'Two', 2],
      [1, 3, 'Three', 3],
      [3, 4, null, null],
      [5, 5, null, null],
    ])
    expect(euphorizer.warnings).toEqual([])

    expect(plan.strays).toEqual([
      expect.objectContaining({
        soundId: fixture.four.id,
        reason: 'not in "euphorizer LP" (album-titles-euphorizer)',
      }),
      expect.objectContaining({
        soundId: fixture.lost.id,
        albumName: 'Lost Tapes',
        reason: 'no collection named "Lost Tapes"',
      }),
    ])
  })

  it('renames and renumbers 1..n, and a second run finds nothing', async () => {
    const plan = await planAlbumTrackTitles(prisma, USERNAME)
    const result = await applyAlbumTrackTitles(prisma, plan)

    expect(result).toEqual({
      applied: ['album-titles-euphorizer', 'album-titles-night'],
      skipped: [],
    })
    expect(await order('album-titles-euphorizer')).toEqual([
      [1, 'One'],
      [2, 'Two'],
      [3, 'Three'],
      [4, 'Other Artist - euphorizer LP - 02 - Guest'],
      [5, 'Bonus jam'],
    ])
    expect(await order('album-titles-night')).toEqual([
      [1, 'Ignition'],
      [2, 'Highway'],
    ])
    expect(await order('album-titles-favs')).toEqual([
      [1, 'Yaniho - euphorizer LP - 04 - Four'],
      [2, 'Yaniho - Something else'],
    ])
    expect((await planAlbumTrackTitles(prisma, USERNAME)).collections).toEqual([])
  })

  it('skips a collection that changed after planning', async () => {
    const plan = await planAlbumTrackTitles(prisma, USERNAME)
    const bonus = await prisma.sound.findFirstOrThrow({ where: { title: 'Bonus jam' } })
    await prisma.collectionItem.deleteMany({ where: { soundId: bonus.id } })

    const result = await applyAlbumTrackTitles(prisma, plan)

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
    const backup = backupFromPlan(plan)
    await applyAlbumTrackTitles(prisma, plan)
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
      const dry = await run(USERNAME, '--backup', backupFile)
      expect(dry.stdout).toContain('2 -> 1    "yaniho - Euphorizer LP - 01 - One" -> "One" (#1)')
      expect(dry.stdout).toContain('DRY RUN')
      const backup = JSON.parse(readFileSync(backupFile, 'utf8')) as AlbumTrackTitleBackup
      expect(backup.sounds).toHaveLength(5)
      expect((await order('album-titles-euphorizer'))[0]).toEqual([
        1,
        'Yaniho - euphorizer LP - 03 - Three',
      ])

      await run(USERNAME, '--backup', backupFile, '--apply')
      expect((await order('album-titles-euphorizer'))[0]).toEqual([1, 'One'])

      await run('--restore', backupFile, '--apply')
      expect((await order('album-titles-euphorizer'))[0]).toEqual([
        1,
        'Yaniho - euphorizer LP - 03 - Three',
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
