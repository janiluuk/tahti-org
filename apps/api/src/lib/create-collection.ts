// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Collection, Prisma, PrismaClient } from '@tahti/db'
import { assignPresetCovers } from './artwork-presets.js'
import { updateCollectionCoverPalette } from './collection-palette.js'

/** The slug a new collection gets when none is asked for. */
export function defaultCollectionSlug(username: string, name: string): string {
  return `${username}-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)}`
}

/**
 * Creates a collection the way the collection editor does: a preset cover
 * when none is given, and the cover's palette extracted in the background.
 * `palette` settles when that extraction is done (it never rejects), for
 * callers such as scripts that must not exit before it. A taken slug throws
 * Prisma's unique-constraint error.
 */
export async function createCollection(
  prisma: PrismaClient,
  data: Prisma.CollectionUncheckedCreateInput,
): Promise<{ collection: Collection; palette: Promise<void> }> {
  let collection = await prisma.collection.create({ data })
  if (!collection.coverUrl && (await assignPresetCovers(prisma, 'collection', [collection.id]))) {
    collection = await prisma.collection.findUniqueOrThrow({ where: { id: collection.id } })
  }
  const palette = collection.coverUrl
    ? updateCollectionCoverPalette(prisma, collection.id, collection.coverUrl)
    : Promise.resolve()
  return { collection, palette }
}
