// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, Prisma } from '@tahti/db'
import { albumKey, parseAlbumTrackTitle, splitAlbumTrackTitle } from '@tahti/shared'
import { createCollection, defaultCollectionSlug } from './create-collection.js'
import { isUniqueConstraintError } from './prisma-errors.js'

export interface AlbumTrackRow {
  itemId: string
  soundId: string | null
  releaseId: string | null
  oldTitle: string | null
  newTitle: string | null
  trackNumber: number | null
  oldPosition: number
  newPosition: number
}

export interface AlbumCollectionPlan {
  id: string
  slug: string
  name: string
  trackSortMode: string
  rows: AlbumTrackRow[]
  warnings: string[]
}

export interface NewAlbumTrack {
  soundId: string
  oldTitle: string
  newTitle: string
  trackNumber: number
  position: number
}

export interface NewAlbumPlan {
  name: string
  slug: string
  style: 'ALBUM' | 'EP'
  tracks: NewAlbumTrack[]
  duplicates: Array<{ soundId: string; title: string; keptSoundId: string }>
  warnings: string[]
}

export interface StrayAlbumTrack {
  soundId: string
  title: string
  albumName: string
  reason: string
}

export interface AlbumTrackTitlePlan {
  username: string
  userId: string
  artistNames: string[]
  collections: AlbumCollectionPlan[]
  newCollections: NewAlbumPlan[]
  strays: StrayAlbumTrack[]
}

export interface CreatedCollectionBackup {
  id: string
  slug: string
  name: string
  itemIds: string[]
}

export interface AlbumTrackTitleBackup {
  version: 1 | 2
  createdAt: string
  username: string
  sounds: Array<{ id: string; title: string; newTitle: string }>
  collections: Array<{
    id: string
    slug: string
    items: Array<{ id: string; position: number; newPosition: number }>
  }>
  createdCollections?: CreatedCollectionBackup[]
}

/** Every name the artist's own titles may start with. */
async function artistNamesFor(
  prisma: PrismaClient,
  user: { username: string; displayName: string | null },
  channel: { id: string; slug: string } | null,
): Promise<string[]> {
  const names = [user.username, user.displayName, channel?.slug]
  if (channel) {
    const credited = await prisma.sound.findMany({
      where: { channelId: channel.id, artistName: { not: null } },
      distinct: ['artistName'],
      select: { artistName: true },
    })
    names.push(...credited.map((sound) => sound.artistName))
  }
  const unique = new Map<string, string>()
  for (const name of names) {
    const trimmed = name?.trim()
    if (trimmed && !unique.has(trimmed.toLowerCase())) unique.set(trimmed.toLowerCase(), trimmed)
  }
  return [...unique.values()]
}

/**
 * The album order of a collection: numbered tracks sorted by number (ties
 * keep their current order), and every other item kept right after the
 * item it follows now, so a bonus track or a remix without a number stays
 * next to its neighbour instead of being pushed to the end. Items before
 * the first numbered track stay at the front.
 */
export function albumOrder<T>(items: T[], trackNumber: (item: T) => number | null): T[] {
  const leading: T[] = []
  const groups: Array<{ head: T; number: number; index: number; followers: T[] }> = []
  items.forEach((item, index) => {
    const number = trackNumber(item)
    if (number === null) (groups[groups.length - 1]?.followers ?? leading).push(item)
    else groups.push({ head: item, number, index, followers: [] })
  })
  groups.sort((a, b) => a.number - b.number || a.index - b.index)
  return [...leading, ...groups.flatMap((group) => [group.head, ...group.followers])]
}

function repeatedNumbers(numbers: number[]): string[] {
  const seen = new Map<number, number>()
  for (const number of numbers) seen.set(number, (seen.get(number) ?? 0) + 1)
  return [...seen]
    .filter(([, count]) => count > 1)
    .map(([number, count]) => `track number ${number} appears ${count} times, current order kept`)
}

async function freeSlug(prisma: PrismaClient, base: string): Promise<string> {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    if (!(await prisma.collection.findUnique({ where: { slug }, select: { id: true } }))) {
      return slug
    }
  }
}

/** The most frequent spelling; on a tie, the one seen first. */
function mostCommon(values: string[]): string {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0]
}

interface MissingAlbumTrack {
  soundId: string
  title: string
  albumName: string
  newTitle: string
  trackNumber: number
  createdAt: Date
}

/** One track per number and title: the newest upload of a repeated one. */
function withoutDuplicates(tracks: MissingAlbumTrack[]) {
  const kept = new Map<string, MissingAlbumTrack>()
  const duplicates: NewAlbumPlan['duplicates'] = []
  for (const track of tracks) {
    const key = `${track.trackNumber}:${track.newTitle.toLowerCase()}`
    const previous = kept.get(key)
    if (!previous) {
      kept.set(key, track)
      continue
    }
    const [newer, older] =
      track.createdAt > previous.createdAt ? [track, previous] : [previous, track]
    kept.set(key, newer)
    duplicates.push({ soundId: older.soundId, title: older.title, keptSoundId: newer.soundId })
  }
  const order = new Map(tracks.map((track, index) => [track.soundId, index]))
  return {
    tracks: [...kept.values()].sort((a, b) => order.get(a.soundId)! - order.get(b.soundId)!),
    duplicates,
  }
}

/**
 * Works out, for each of the user's collections, which of the artist's own
 * tracks are titled "Artist - <collection name> - NN - Title": those get the
 * plain title and the collection is put in album order (`albumOrder`).
 * Collections where nothing matches are left out entirely. Album-form
 * titles whose album has no collection are planned as new private
 * collections; those whose album exists but who are not in it are listed.
 */
export async function planAlbumTrackTitles(
  prisma: PrismaClient,
  username: string,
): Promise<AlbumTrackTitlePlan> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      channel: { select: { id: true, slug: true } },
    },
  })
  if (!user) throw new Error(`No user with username "${username}"`)
  const artistNames = await artistNamesFor(prisma, user, user.channel)
  const ownChannelId = user.channel?.id ?? null

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      trackSortMode: true,
      items: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          position: true,
          soundId: true,
          releaseId: true,
          sound: { select: { title: true, channelId: true } },
        },
      },
    },
  })

  const renamed = new Set<string>()
  const plans: AlbumCollectionPlan[] = []
  for (const collection of collections) {
    const parsed = collection.items.map((item) => {
      const own = item.sound && item.sound.channelId === ownChannelId
      const match = own
        ? parseAlbumTrackTitle(item.sound!.title, { artistNames, albumName: collection.name })
        : null
      return { item, match }
    })
    if (!parsed.some((entry) => entry.match)) continue

    const ordered = albumOrder(parsed, (entry) => entry.match?.trackNumber ?? null)
    const rows = ordered.map(({ item, match }, index) => ({
      itemId: item.id,
      soundId: item.soundId,
      releaseId: item.releaseId,
      oldTitle: item.sound?.title ?? null,
      newTitle: match?.title ?? null,
      trackNumber: match?.trackNumber ?? null,
      oldPosition: item.position,
      newPosition: index + 1,
    }))
    for (const row of rows) if (row.newTitle && row.soundId) renamed.add(row.soundId)

    const warnings = repeatedNumbers(
      parsed.flatMap((entry) => (entry.match ? [entry.match.trackNumber] : [])),
    )
    if (collection.trackSortMode !== 'MANUAL') {
      warnings.push(
        `sorted by ${collection.trackSortMode}, so listeners do not see the album order until it is set to MANUAL`,
      )
    }
    plans.push({
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
      trackSortMode: collection.trackSortMode,
      rows,
      warnings,
    })
  }

  const strays: StrayAlbumTrack[] = []
  const missing = new Map<string, MissingAlbumTrack[]>()
  if (ownChannelId) {
    const sounds = await prisma.sound.findMany({
      where: { channelId: ownChannelId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        collectionItems: {
          where: { collection: { userId: user.id } },
          select: { collection: { select: { name: true } } },
        },
      },
    })
    for (const sound of sounds) {
      if (renamed.has(sound.id)) continue
      const split = splitAlbumTrackTitle(sound.title, { artistNames })
      if (!split) continue
      const stray = { soundId: sound.id, title: sound.title, albumName: split.albumName }
      const album = collections.find(
        (collection) => albumKey(collection.name) === albumKey(split.albumName),
      )
      if (album) {
        const elsewhere = sound.collectionItems.map((item) => `"${item.collection.name}"`)
        strays.push({
          ...stray,
          reason:
            `not in "${album.name}" (${album.slug})` +
            (elsewhere.length > 0 ? `, but in ${elsewhere.join(', ')}` : ''),
        })
      } else if (sound.status !== 'READY') {
        strays.push({ ...stray, reason: `${sound.status}, so not added to a new collection` })
      } else {
        const key = albumKey(split.albumName)
        missing.set(key, [
          ...(missing.get(key) ?? []),
          {
            ...stray,
            newTitle: split.title,
            trackNumber: split.trackNumber,
            createdAt: sound.createdAt,
          },
        ])
      }
    }
  }

  const newCollections: NewAlbumPlan[] = []
  for (const found of missing.values()) {
    const name = mostCommon(found.map((track) => track.albumName))
    const { tracks, duplicates } = withoutDuplicates(found)
    const ordered = albumOrder(tracks, (track) => track.trackNumber)
    newCollections.push({
      name,
      slug: await freeSlug(prisma, defaultCollectionSlug(user.username, name)),
      style: /\sEP$/i.test(name) ? 'EP' : 'ALBUM',
      tracks: ordered.map((track, index) => ({
        soundId: track.soundId,
        oldTitle: track.title,
        newTitle: track.newTitle,
        trackNumber: track.trackNumber,
        position: index + 1,
      })),
      duplicates,
      warnings: repeatedNumbers(ordered.map((track) => track.trackNumber)),
    })
  }

  return {
    username: user.username,
    userId: user.id,
    artistNames,
    collections: plans,
    newCollections,
    strays,
  }
}

export function backupFromPlan(
  plan: AlbumTrackTitlePlan,
  options: { createMissing: boolean },
  now = new Date(),
): AlbumTrackTitleBackup {
  const sounds = new Map<string, { id: string; title: string; newTitle: string }>()
  for (const collection of plan.collections) {
    for (const row of collection.rows) {
      if (row.soundId && row.oldTitle !== null && row.newTitle !== null) {
        sounds.set(row.soundId, { id: row.soundId, title: row.oldTitle, newTitle: row.newTitle })
      }
    }
  }
  if (options.createMissing) {
    for (const collection of plan.newCollections) {
      for (const track of collection.tracks) {
        sounds.set(track.soundId, {
          id: track.soundId,
          title: track.oldTitle,
          newTitle: track.newTitle,
        })
      }
    }
  }
  return {
    version: 2,
    createdAt: now.toISOString(),
    username: plan.username,
    sounds: [...sounds.values()],
    collections: plan.collections.map((collection) => ({
      id: collection.id,
      slug: collection.slug,
      items: collection.rows.map((row) => ({
        id: row.itemId,
        position: row.oldPosition,
        newPosition: row.newPosition,
      })),
    })),
    createdCollections: [],
  }
}

export function describePlan(
  plan: AlbumTrackTitlePlan,
  options: { createMissing: boolean },
): string[] {
  const lines = [`Artist @${plan.username}, names matched: ${plan.artistNames.join(', ')}`]
  if (plan.collections.length === 0) lines.push('No collection has tracks to rename.')
  for (const collection of plan.collections) {
    lines.push('', `Collection "${collection.name}" (${collection.slug})`)
    for (const row of collection.rows) {
      const position = `${row.oldPosition} -> ${row.newPosition}`.padEnd(9)
      const label = row.soundId ? `"${row.oldTitle}"` : `release ${row.releaseId ?? '(removed)'}`
      lines.push(
        row.newTitle
          ? `  ${position} ${label} -> "${row.newTitle}" (#${row.trackNumber})`
          : `  ${position} ${label} (title kept)`,
      )
    }
    for (const warning of collection.warnings) lines.push(`  warning: ${warning}`)
  }
  if (plan.newCollections.length > 0) {
    lines.push(
      '',
      options.createMissing
        ? 'New private collections:'
        : 'Albums with no collection (made as private collections with --create-missing):',
    )
    for (const collection of plan.newCollections) {
      lines.push('', `New ${collection.style} "${collection.name}" (${collection.slug}), private`)
      for (const track of collection.tracks) {
        const position = `${track.position}`.padEnd(9)
        lines.push(
          `  ${position} "${track.oldTitle}" -> "${track.newTitle}" (#${track.trackNumber})`,
        )
      }
      for (const duplicate of collection.duplicates) {
        lines.push(
          `  duplicate, not added: "${duplicate.title}" (${duplicate.soundId}); the newer ${duplicate.keptSoundId} is`,
        )
      }
      for (const warning of collection.warnings) lines.push(`  warning: ${warning}`)
    }
  }
  if (plan.strays.length > 0) {
    lines.push('', 'Titles in album form left unchanged:')
    for (const stray of plan.strays)
      lines.push(`  "${stray.title}" (${stray.soundId}): ${stray.reason}`)
  }
  return lines
}

/** Two passes through negative numbers, so @@unique([collectionId, position])
 * never sees two items on one number while they swap. */
async function setPositions(
  tx: Prisma.TransactionClient,
  positions: Array<{ id: string; position: number }>,
): Promise<void> {
  for (const { id, position } of positions) {
    await tx.collectionItem.update({ where: { id }, data: { position: -position } })
  }
  for (const { id, position } of positions) {
    await tx.collectionItem.update({ where: { id }, data: { position } })
  }
}

async function currentItems(tx: Prisma.TransactionClient, collectionId: string) {
  const items = await tx.collectionItem.findMany({
    where: { collectionId },
    select: { id: true, position: true, sound: { select: { id: true, title: true } } },
  })
  return new Map(items.map((item) => [item.id, item]))
}

export interface ApplyResult {
  applied: string[]
  created: CreatedCollectionBackup[]
  skipped: Array<{ slug: string; reason: string }>
  /** Settles once background work on the created collections (the cover
   * palette) is done. */
  settled: Promise<void>
}

/**
 * One transaction per collection. A collection whose items or titles
 * changed since the plan was made is skipped, not half-applied. New
 * collections are made only with `createMissing`; `onCreated` hears of each
 * as soon as it exists, so a backup records it before anything else can fail.
 */
export async function applyAlbumTrackTitles(
  prisma: PrismaClient,
  plan: AlbumTrackTitlePlan,
  options: {
    createMissing: boolean
    onCreated?: (created: CreatedCollectionBackup) => void
  },
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: [], created: [], skipped: [], settled: Promise.resolve() }
  for (const collection of plan.collections) {
    try {
      await prisma.$transaction(async (tx) => {
        const items = await currentItems(tx, collection.id)
        const unchanged =
          items.size === collection.rows.length &&
          collection.rows.every((row) => {
            const item = items.get(row.itemId)
            return (
              item &&
              item.position === row.oldPosition &&
              (row.newTitle === null || item.sound?.title === row.oldTitle)
            )
          })
        if (!unchanged) throw new SkipCollection('items changed since the plan was made')

        for (const row of collection.rows) {
          if (row.soundId && row.newTitle !== null) {
            await tx.sound.update({ where: { id: row.soundId }, data: { title: row.newTitle } })
          }
        }
        await setPositions(
          tx,
          collection.rows
            .filter((row) => row.oldPosition !== row.newPosition)
            .map((row) => ({ id: row.itemId, position: row.newPosition })),
        )
      })
      result.applied.push(collection.slug)
    } catch (err) {
      if (!(err instanceof SkipCollection)) throw err
      result.skipped.push({ slug: collection.slug, reason: err.message })
    }
  }

  if (!options.createMissing) return result
  const palettes: Array<Promise<void>> = []
  for (const planned of plan.newCollections) {
    const sounds = await prisma.sound.findMany({
      where: { id: { in: planned.tracks.map((track) => track.soundId) } },
      select: { id: true, title: true },
    })
    const titles = new Map(sounds.map((sound) => [sound.id, sound.title]))
    if (planned.tracks.some((track) => titles.get(track.soundId) !== track.oldTitle)) {
      result.skipped.push({ slug: planned.slug, reason: 'titles changed since the plan was made' })
      continue
    }
    let made: Awaited<ReturnType<typeof createCollection>>
    try {
      made = await createCollection(prisma, {
        userId: plan.userId,
        slug: planned.slug,
        name: planned.name,
        style: planned.style,
        isPublic: false,
        visibility: 'DRAFT',
        trackSortMode: 'MANUAL',
        items: {
          create: planned.tracks.map((track) => ({
            soundId: track.soundId,
            position: track.position,
            addedByUserId: plan.userId,
          })),
        },
      })
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err
      result.skipped.push({ slug: planned.slug, reason: 'slug taken since the plan was made' })
      continue
    }
    palettes.push(made.palette)
    const items = await prisma.collectionItem.findMany({
      where: { collectionId: made.collection.id },
      select: { id: true },
    })
    const created = {
      id: made.collection.id,
      slug: made.collection.slug,
      name: made.collection.name,
      itemIds: items.map((item) => item.id),
    }
    result.created.push(created)
    options.onCreated?.(created)
    await prisma.$transaction(
      planned.tracks.map((track) =>
        prisma.sound.update({ where: { id: track.soundId }, data: { title: track.newTitle } }),
      ),
    )
  }
  result.settled = Promise.all(palettes).then(() => undefined)
  return result
}

class SkipCollection extends Error {}

export interface RestoreResult {
  titles: Array<{ soundId: string; from: string; to: string }>
  positions: Array<{ slug: string; itemId: string; from: number; to: number }>
  deleted: Array<{ id: string; slug: string }>
  skipped: string[]
}

/**
 * Puts back the titles and positions in a backup and deletes the
 * collections the script made. A title someone edited after the rename is
 * kept, a collection whose items changed since is left alone, and a made
 * collection is deleted only while it holds nothing but the script's items,
 * so a restore never overwrites newer work. Writes only when `apply` is set.
 */
export async function restoreAlbumTrackTitles(
  prisma: PrismaClient,
  backup: AlbumTrackTitleBackup,
  options: { apply: boolean },
): Promise<RestoreResult> {
  if (backup.version !== 1 && backup.version !== 2) {
    throw new Error(`Unknown backup version ${String(backup.version)}`)
  }
  const result: RestoreResult = { titles: [], positions: [], deleted: [], skipped: [] }

  for (const sound of backup.sounds) {
    const current = await prisma.sound.findUnique({
      where: { id: sound.id },
      select: { title: true },
    })
    if (!current) {
      result.skipped.push(`sound ${sound.id}: deleted`)
    } else if (current.title === sound.title) {
      continue
    } else if (current.title !== sound.newTitle) {
      result.skipped.push(`sound ${sound.id}: title is now "${current.title}", kept`)
    } else {
      result.titles.push({ soundId: sound.id, from: current.title, to: sound.title })
      if (options.apply) {
        await prisma.sound.update({ where: { id: sound.id }, data: { title: sound.title } })
      }
    }
  }

  for (const collection of backup.collections) {
    await prisma.$transaction(async (tx) => {
      const items = await currentItems(tx, collection.id)
      const matches =
        items.size === collection.items.length &&
        collection.items.every((item) => items.has(item.id))
      if (!matches) {
        result.skipped.push(`collection ${collection.slug}: items changed since the backup`)
        return
      }
      const moves = collection.items
        .filter((item) => items.get(item.id)!.position !== item.position)
        .map((item) => ({ id: item.id, position: item.position }))
      for (const move of moves) {
        result.positions.push({
          slug: collection.slug,
          itemId: move.id,
          from: items.get(move.id)!.position,
          to: move.position,
        })
      }
      if (options.apply) await setPositions(tx, moves)
    })
  }

  for (const created of backup.createdCollections ?? []) {
    await prisma.$transaction(async (tx) => {
      const exists = await tx.collection.findUnique({
        where: { id: created.id },
        select: { id: true },
      })
      if (!exists) {
        result.skipped.push(`collection ${created.slug}: already deleted`)
        return
      }
      const ours = new Set(created.itemIds)
      const items = await currentItems(tx, created.id)
      if ([...items.keys()].some((id) => !ours.has(id))) {
        result.skipped.push(`collection ${created.slug}: has items added since, kept`)
        return
      }
      result.deleted.push({ id: created.id, slug: created.slug })
      if (options.apply) await tx.collection.delete({ where: { id: created.id } })
    })
  }
  return result
}
