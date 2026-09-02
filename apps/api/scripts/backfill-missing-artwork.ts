// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Fixes published/public content that has no cover art at all (a plain
 * upload via /api/uploads/complete never gets a bannerUrl unless the artist
 * sets one; a CSV release import never sets artworkUrl/artworkKey either —
 * both render as a blank/white cover in every grid and row that has no
 * placeholder gradient), and separately backfills the extracted color
 * palette (paletteJson) for anything that already has real cover art but
 * predates the palette-extraction wiring on that upload path.
 *
 * Real artwork always wins over a generated one — this only touches rows
 * with NO cover key/URL at all. It never overwrites an artist's own upload.
 *
 * Idempotent: re-running only ever touches rows still missing artwork or
 * still missing a palette; already-fixed rows are skipped on the next run.
 *
 * Run:
 *   docker compose exec api tsx apps/api/scripts/backfill-missing-artwork.ts
 *   docker compose exec api tsx apps/api/scripts/backfill-missing-artwork.ts --dry-run
 */

import { nanoid } from 'nanoid'
import { prisma } from '@tahti/db'
import { BRAND_ACCENT_PRESETS } from '@tahti/shared'
import { generateAlbumArtSvg, type AlbumArtColors } from '../src/lib/generate-cover-art.js'
import { putObjectText } from '../src/lib/minio.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'
import { resolveReleaseArtworkUrl } from '../src/lib/release-artwork.js'
import { resolveCollectionCoverUrl } from '../src/lib/collection-cover.js'
import { extractPalette } from '../src/lib/palette-extract.js'

const DRY_RUN = process.argv.includes('--dry-run')
const DEFAULT_COLORS: AlbumArtColors = { bg: '#0A0E1C', accent: '#22D3EE', highlight: '#A78BFA' }

function colorsForPreset(brandAccentPreset: string | null | undefined): AlbumArtColors {
  const preset = BRAND_ACCENT_PRESETS.find((p) => p.id === brandAccentPreset)
  if (!preset) return DEFAULT_COLORS
  return { bg: DEFAULT_COLORS.bg, accent: preset.accent, highlight: preset.highlight }
}

async function storePaletteIfMissing(
  table: 'release' | 'collection',
  id: string,
  currentColorSchemeJson: string | null,
  coverUrl: string,
): Promise<boolean> {
  const palette = await extractPalette(coverUrl)
  if (!palette) return false
  if (DRY_RUN) return true
  const paletteStr = JSON.stringify(palette)
  const data = {
    paletteJson: paletteStr,
    ...(currentColorSchemeJson ? {} : { colorSchemeJson: paletteStr }),
  }
  if (table === 'release') {
    await prisma.release.update({ where: { id }, data })
  } else {
    await prisma.collection.update({ where: { id }, data })
  }
  return true
}

async function backfillReleases() {
  const releases = await prisma.release.findMany({
    where: { state: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      genre: true,
      artworkKey: true,
      artworkUrl: true,
      paletteJson: true,
      colorSchemeJson: true,
      user: { select: { username: true, displayName: true, channel: true } },
    },
  })

  let generated = 0
  let paletteBackfilled = 0
  for (const release of releases) {
    const colors = colorsForPreset(release.user.channel?.brandAccentPreset)
    let artworkKey = release.artworkKey
    if (!artworkKey && !release.artworkUrl) {
      artworkKey = `releases/${release.user.username}/${release.id}/artwork-${nanoid(8)}-generated.svg`
      if (!DRY_RUN) {
        const svg = generateAlbumArtSvg(release.title, release.user.displayName, {
          genre: release.genre ?? undefined,
          colors,
        })
        await putObjectText(artworkKey, svg, 'image/svg+xml')
        await prisma.release.update({
          where: { id: release.id },
          data: { artworkKey, artworkUrl: null },
        })
      }
      generated++
    }

    if (!release.paletteJson) {
      const coverUrl = await resolveReleaseArtworkUrl({
        artworkKey,
        artworkUrl: release.artworkUrl,
      })
      if (coverUrl) {
        const ok = await storePaletteIfMissing(
          'release',
          release.id,
          release.colorSchemeJson,
          coverUrl,
        )
        if (ok) paletteBackfilled++
      }
    }
  }
  return { checked: releases.length, generated, paletteBackfilled }
}

async function backfillCollections() {
  const collections = await prisma.collection.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      slug: true,
      name: true,
      coverKey: true,
      coverUrl: true,
      paletteJson: true,
      colorSchemeJson: true,
      user: { select: { username: true, displayName: true, channel: true } },
    },
  })

  let generated = 0
  let paletteBackfilled = 0
  for (const col of collections) {
    const colors = colorsForPreset(col.user.channel?.brandAccentPreset)
    let coverKey = col.coverKey
    if (!coverKey && !col.coverUrl) {
      coverKey = `collections/${col.user.username}/${col.slug}/cover-${nanoid(8)}-generated.svg`
      if (!DRY_RUN) {
        const svg = generateAlbumArtSvg(col.name, col.user.displayName, { colors })
        await putObjectText(coverKey, svg, 'image/svg+xml')
        await prisma.collection.update({
          where: { id: col.id },
          data: { coverKey, coverUrl: null },
        })
      }
      generated++
    }

    if (!col.paletteJson) {
      const coverUrl = await resolveCollectionCoverUrl({ coverKey, coverUrl: col.coverUrl })
      if (coverUrl) {
        const ok = await storePaletteIfMissing('collection', col.id, col.colorSchemeJson, coverUrl)
        if (ok) paletteBackfilled++
      }
    }
  }
  return { checked: collections.length, generated, paletteBackfilled }
}

/** ArchiveItem has no paletteJson extraction pipeline yet (by design — see
 * the field comment in schema.prisma) — only the missing-cover case applies. */
async function backfillArchiveItems() {
  const items = await prisma.archiveItem.findMany({
    where: { status: 'READY', isPublic: true, bannerUrl: null },
    select: {
      id: true,
      title: true,
      genre: true,
      channel: { select: { user: { select: { username: true, displayName: true } } } },
    },
  })

  let generated = 0
  for (const item of items) {
    if (!item.channel) continue
    const key = `archive/${item.channel.user.username}/${item.id}/banner-${nanoid(8)}-generated.svg`
    if (!DRY_RUN) {
      const svg = generateAlbumArtSvg(item.title, item.channel.user.displayName, {
        genre: item.genre ?? undefined,
        colors: DEFAULT_COLORS,
      })
      await putObjectText(key, svg, 'image/svg+xml')
      const bannerUrl = publicMediaUrl(key)
      await prisma.archiveItem.update({ where: { id: item.id }, data: { bannerUrl } })
    }
    generated++
  }
  return { checked: items.length, generated }
}

async function main() {
  const releases = await backfillReleases()
  const collections = await backfillCollections()
  const archiveItems = await backfillArchiveItems()

  console.log(
    JSON.stringify({ ok: true, dryRun: DRY_RUN, releases, collections, archiveItems }, null, 2),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
