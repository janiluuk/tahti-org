// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, Prisma } from '@tahti/db'
import { parseAlbumTrackTitle, splitAlbumTrackTitle } from '@tahti/shared'

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

export interface StrayAlbumTrack {
  soundId: string
  title: string
  albumName: string
  reason: string
}

export interface AlbumTrackTitlePlan {
  username: string
  artistNames: string[]
  collections: AlbumCollectionPlan[]
  strays: StrayAlbumTrack[]
}

export interface AlbumTrackTitleBackup {
  version: 1
  createdAt: string
  username: string
  sounds: Array<{ id: string; title: string; newTitle: string }>
  collections: Array<{
    id: string
    slug: string
    items: Array<{ id: string; position: number; newPosition: number }>
  }>
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
 * Works out, for each of the user's collections, which of the artist's own
 * tracks are titled "Artist - <collection name> - NN - Title": those get the
 * plain title and go to the front of the collection in NN order (ties keep
 * their current order). Every other item keeps its current relative order
 * after them. Collections where nothing matches are left out entirely.
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

    const numbered = parsed
      .filter((entry) => entry.match)
      .sort((a, b) => a.match!.trackNumber - b.match!.trackNumber)
    const rest = parsed.filter((entry) => !entry.match)
    const rows = [...numbered, ...rest].map(({ item, match }, index) => ({
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

    const warnings: string[] = []
    const seen = new Map<number, number>()
    for (const { match } of numbered) {
      seen.set(match!.trackNumber, (seen.get(match!.trackNumber) ?? 0) + 1)
    }
    for (const [trackNumber, count] of seen) {
      if (count > 1) warnings.push(`track number ${trackNumber} appears ${count} times`)
    }
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
  if (ownChannelId) {
    const sounds = await prisma.sound.findMany({
      where: { channelId: ownChannelId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true },
    })
    for (const sound of sounds) {
      if (renamed.has(sound.id)) continue
      const split = splitAlbumTrackTitle(sound.title, { artistNames })
      if (!split) continue
      const album = collections.find(
        (collection) =>
          parseAlbumTrackTitle(sound.title, { artistNames, albumName: collection.name }) !== null,
      )
      strays.push({
        soundId: sound.id,
        title: sound.title,
        albumName: split.albumName,
        reason: album
          ? `not in "${album.name}" (${album.slug})`
          : `no collection named "${split.albumName}"`,
      })
    }
  }

  return { username: user.username, artistNames, collections: plans, strays }
}

export function backupFromPlan(plan: AlbumTrackTitlePlan, now = new Date()): AlbumTrackTitleBackup {
  const sounds = new Map<string, { id: string; title: string; newTitle: string }>()
  for (const collection of plan.collections) {
    for (const row of collection.rows) {
      if (row.soundId && row.oldTitle !== null && row.newTitle !== null) {
        sounds.set(row.soundId, { id: row.soundId, title: row.oldTitle, newTitle: row.newTitle })
      }
    }
  }
  return {
    version: 1,
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
  }
}

export function describePlan(plan: AlbumTrackTitlePlan): string[] {
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
  skipped: Array<{ slug: string; reason: string }>
}

/** One transaction per collection. A collection whose items or titles
 * changed since the plan was made is skipped, not half-applied. */
export async function applyAlbumTrackTitles(
  prisma: PrismaClient,
  plan: AlbumTrackTitlePlan,
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: [], skipped: [] }
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
  return result
}

class SkipCollection extends Error {}

export interface RestoreResult {
  titles: Array<{ soundId: string; from: string; to: string }>
  positions: Array<{ slug: string; itemId: string; from: number; to: number }>
  skipped: string[]
}

/**
 * Puts back the titles and positions in a backup. A title someone edited
 * after the rename is kept, and a collection whose items changed since is
 * left alone, so a restore never overwrites newer work. Writes only when
 * `apply` is set.
 */
export async function restoreAlbumTrackTitles(
  prisma: PrismaClient,
  backup: AlbumTrackTitleBackup,
  options: { apply: boolean },
): Promise<RestoreResult> {
  if (backup.version !== 1) throw new Error(`Unknown backup version ${String(backup.version)}`)
  const result: RestoreResult = { titles: [], positions: [], skipped: [] }

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
  return result
}
