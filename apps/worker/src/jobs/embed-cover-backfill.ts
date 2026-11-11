// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { assignPresetCovers, prisma } from '@tahti/db'
import { resolveEmbedProviderCovers } from '@tahti/shared'

const BATCH_SIZE = 100
const PROVIDER_BUDGET_MS = 60_000
const PROVIDER_CAP = 50

/** Nightly version of the artist's "Fill missing covers": embedded sounds
 * with no banner get the provider's cover, the rest an artwork preset. */
export async function processEmbedCoverBackfillJob(): Promise<{
  matched: number
  fromProvider: number
  fromPresets: number
}> {
  const rows = await prisma.sound.findMany({
    where: { bannerUrl: null, embedProvider: { not: null } },
    select: { id: true, embedProvider: true, embedUri: true, embedSourceUrl: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  })
  if (rows.length === 0) return { matched: 0, fromProvider: 0, fromPresets: 0 }

  const { covers } = await resolveEmbedProviderCovers(rows, {
    cap: PROVIDER_CAP,
    budgetMs: PROVIDER_BUDGET_MS,
  })
  for (const [id, bannerUrl] of covers) {
    await prisma.sound.update({ where: { id }, data: { bannerUrl } })
  }
  const rest = rows.filter((row) => !covers.has(row.id)).map((row) => row.id)
  const fromPresets = rest.length > 0 ? await assignPresetCovers(prisma, 'sound', rest) : 0
  return { matched: rows.length, fromProvider: covers.size, fromPresets }
}
