// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { extractPalette } from './palette-extract.js'

/** Fire-and-forget — don't block the caller's response on palette
 * extraction. Mirrors the release-artwork palette refresh: store the raw
 * extraction in paletteJson, and only seed colorSchemeJson (the artist's
 * editable override) when nothing has been set there yet. */
export function refreshCollectionCoverPalette(
  prisma: PrismaClient,
  collectionId: string,
  coverUrl: string,
): void {
  extractPalette(coverUrl)
    .then(async (palette) => {
      if (!palette) return
      const current = await prisma.collection.findUnique({
        where: { id: collectionId },
        select: { colorSchemeJson: true },
      })
      const paletteStr = JSON.stringify(palette)
      return prisma.collection.update({
        where: { id: collectionId },
        data: {
          paletteJson: paletteStr,
          ...(current?.colorSchemeJson ? {} : { colorSchemeJson: paletteStr }),
        },
      })
    })
    .catch(() => undefined)
}
