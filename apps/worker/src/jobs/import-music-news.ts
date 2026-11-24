// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import {
  fetchText,
  MUSIC_NEWS_SOURCES,
  parseRssEntries,
  type MusicNewsSource,
} from '../lib/music-feeds.js'

/** Newest items per feed considered on each run. */
export const NEWS_ITEMS_PER_FEED = 10

export interface ImportMusicNewsResult {
  imported: number
  skipped: number
  failedSources: string[]
}

/**
 * Pulls the approved Finnish music news feeds into NewsPost as unpublished
 * drafts (publishedAt null) for the board to review in Admin → News. Each
 * story is keyed by (sourceKey, externalId), so re-runs only add new ones.
 */
export async function processImportMusicNewsJob(
  prisma: PrismaClient,
  sources: readonly MusicNewsSource[] = MUSIC_NEWS_SOURCES,
): Promise<ImportMusicNewsResult> {
  let imported = 0
  let skipped = 0
  const failedSources: string[] = []

  for (const source of sources) {
    let entries
    try {
      const xml = await fetchText(source.feedUrl, 'application/rss+xml, application/xml, text/xml')
      entries = parseRssEntries(xml).slice(0, NEWS_ITEMS_PER_FEED)
    } catch (err) {
      failedSources.push(source.key)
      console.warn(
        JSON.stringify({
          component: 'import-music-news',
          msg: `feed fetch failed: ${source.key}`,
          source: source.key,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
      continue
    }

    const known = await prisma.newsPost.findMany({
      where: {
        sourceKey: source.key,
        externalId: { in: entries.map((entry) => entry.externalId) },
      },
      select: { externalId: true },
    })
    const seen = new Set(known.map((row) => row.externalId))

    for (const entry of entries) {
      if (seen.has(entry.externalId)) {
        skipped++
        continue
      }
      await prisma.newsPost.create({
        data: {
          headline: entry.title,
          summary: entry.excerpt,
          linkUrl: entry.link,
          linkLabel: `Read on ${source.name}`,
          authorName: source.name,
          sourceKey: source.key,
          externalId: entry.externalId,
          publishedAt: null,
          ...(entry.publishedAt ? { createdAt: entry.publishedAt } : {}),
        },
      })
      imported++
    }
  }

  console.log(
    JSON.stringify({
      component: 'import-music-news',
      msg: `imported ${imported} news draft(s)`,
      imported,
      skipped,
      failedSources,
    }),
  )
  return { imported, skipped, failedSources }
}
