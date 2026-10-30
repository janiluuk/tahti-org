// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const ARTWORK_PRESET_SELECT = {
  id: true,
  url: true,
  enabled: true,
  position: true,
} as const

function webBase(): string {
  return (process.env.PUBLIC_WEB_URL ?? 'https://tahti.live').replace(/\/$/, '')
}

/** Built-in presets are web-app paths; covers are read from embeds,
 * emails and the desktop app, so they are always stored absolute. */
export function absoluteArtworkUrl(url: string): string {
  return url.startsWith('/') ? `${webBase()}${url}` : url
}

export function presetDto<T extends { url: string }>(preset: T): T {
  return { ...preset, url: absoluteArtworkUrl(preset.url) }
}

export async function enabledArtworkPresetUrls(
  prisma: Pick<PrismaClient, 'artworkPreset'>,
): Promise<string[]> {
  const presets = await prisma.artworkPreset.findMany({
    where: { enabled: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { url: true },
  })
  return presets.map((preset) => absoluteArtworkUrl(preset.url))
}

/** Stable pick: the same seed lands on the same preset while the enabled
 * set is unchanged. */
export function pickArtworkUrl(urls: readonly string[], seed: string): string | null {
  if (urls.length === 0) return null
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return urls[hash % urls.length] ?? null
}

export async function presetCoverFor(
  prisma: Pick<PrismaClient, 'artworkPreset'>,
  seed: string,
): Promise<string | null> {
  return pickArtworkUrl(await enabledArtworkPresetUrls(prisma), seed)
}

type CoverPrisma = Pick<PrismaClient, 'artworkPreset' | 'sound' | 'collection' | 'user'>

/** Gives each listed item that still has no cover an enabled preset.
 * The `null` guard makes it safe to race an owner's own upload and to
 * re-run as a backfill. Returns how many rows changed. */
export async function assignPresetCovers(
  prisma: CoverPrisma,
  kind: 'sound' | 'collection' | 'avatar',
  ids: readonly string[],
): Promise<number> {
  const urls = await enabledArtworkPresetUrls(prisma)
  if (urls.length === 0 || ids.length === 0) return 0
  let changed = 0
  for (const id of ids) {
    const url = pickArtworkUrl(urls, id)!
    const { count } =
      kind === 'sound'
        ? await prisma.sound.updateMany({
            where: { id, bannerUrl: null },
            data: { bannerUrl: url },
          })
        : kind === 'collection'
          ? await prisma.collection.updateMany({
              where: { id, coverUrl: null, coverKey: null },
              data: { coverUrl: url },
            })
          : await prisma.user.updateMany({
              where: { id, avatarUrl: null },
              data: { avatarUrl: url },
            })
    changed += count
  }
  return changed
}
