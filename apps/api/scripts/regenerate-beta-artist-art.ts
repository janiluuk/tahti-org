// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Upgrades cover art for the 16 "[BETA]" placeholder artists' catalog from
 * the old flat two-circle gradient to genre-motif art (see
 * generateAlbumArtSvg / generateChannelBannerSvg), colored from each
 * artist's own brand accent/highlight so the catalog reads as art-directed
 * rather than randomly gradiented. Also adds a matching widescreen channel
 * banner (videoBackgroundUrl) per artist.
 *
 * Release/ArchiveItem art is overwritten IN PLACE at the same MinIO keys
 * already referenced by existing DB rows — no DB writes needed for those
 * (artworkKey/bannerUrl already point at these objects). Only the channel
 * banner is new, so that's the one field this script updates.
 *
 * Idempotent: same title/seed always regenerates the same art; re-running
 * just re-uploads identical bytes.
 *
 * Run (prod): ssh vimage, then:
 *   docker compose exec api tsx apps/api/scripts/regenerate-beta-artist-art.ts
 */

import { prisma } from '@tahti/db'
import { generateAlbumArtSvg, generateChannelBannerSvg } from '../src/lib/generate-cover-art.js'
import { putObjectText } from '../src/lib/minio.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'
import { config } from '../src/config.js'
import { BRAND_ACCENT_PRESETS } from '@tahti/shared'

const DEFAULT_BG = '#0A0E1C'
const DEFAULT_COLORS = { bg: DEFAULT_BG, accent: '#22D3EE', highlight: '#A78BFA' }

function colorsForPreset(brandAccentPreset: string | null): {
  bg: string
  accent: string
  highlight: string
} {
  const preset = BRAND_ACCENT_PRESETS.find((p) => p.id === brandAccentPreset)
  if (!preset) return DEFAULT_COLORS
  return { bg: DEFAULT_BG, accent: preset.accent, highlight: preset.highlight }
}

/** Public MinIO object key from a previously-published public URL — inverts
 * publicMediaUrl(). Returns null for anything not shaped like our own bucket. */
function keyFromPublicUrl(url: string | null): string | null {
  if (!url) return null
  const base = `${config.minio.publicEndpoint.replace(/\/$/, '')}/${config.minio.bucket}/`
  return url.startsWith(base) ? url.slice(base.length) : null
}

async function main() {
  const artists = await prisma.user.findMany({
    where: { email: { endsWith: '@beta.tahti.live' } },
    include: { channel: true },
    orderBy: { username: 'asc' },
  })
  if (artists.length === 0) throw new Error('No @beta.tahti.live artists found')

  const results: Array<{
    username: string
    releasesUpdated: number
    archiveItemsUpdated: number
    bannerUpdated: boolean
  }> = []

  for (const artist of artists) {
    if (!artist.channel || !artist.username) continue
    const channel = artist.channel
    const displayName = artist.displayName ?? artist.username
    const displayBase = displayName.replace(' [BETA]', '')
    const colors = colorsForPreset(channel.brandAccentPreset)

    const releases = await prisma.release.findMany({
      where: { userId: artist.id },
      select: { id: true, title: true, genre: true, artworkKey: true },
    })
    let releasesUpdated = 0
    for (const release of releases) {
      if (!release.artworkKey) continue
      const svg = generateAlbumArtSvg(release.title, displayName, {
        genre: release.genre ?? undefined,
        colors,
      })
      await putObjectText(release.artworkKey, svg, 'image/svg+xml')
      releasesUpdated++
    }

    const archiveItems = await prisma.archiveItem.findMany({
      where: { channelId: channel.id },
      select: { id: true, title: true, genre: true, bannerUrl: true },
    })
    let archiveItemsUpdated = 0
    for (const item of archiveItems) {
      const key = keyFromPublicUrl(item.bannerUrl)
      if (!key) continue
      const svg = generateAlbumArtSvg(item.title, displayName, {
        genre: item.genre ?? undefined,
        colors,
      })
      await putObjectText(key, svg, 'image/svg+xml')
      archiveItemsUpdated++
    }

    // Genre for the banner: whatever this artist's releases already use (set
    // uniformly by seed-beta-artists.ts / seed-beta-artist-catalog-expansion.ts).
    const genre = releases[0]?.genre ?? undefined
    // Must live under a publicly-readable prefix (archive*/avatars*/posts*/
    // press-kit* only — release* and channel* are not, confirmed live against
    // the bucket's actual policy before picking this path).
    const bannerKey = `archive/${channel.slug}/channel-banner.svg`
    const bannerSvg = generateChannelBannerSvg(channel.slug, { genre, colors })
    await putObjectText(bannerKey, bannerSvg, 'image/svg+xml')
    const bannerUrl = publicMediaUrl(bannerKey)
    if (bannerUrl && channel.videoBackgroundUrl !== bannerUrl) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { videoBackgroundUrl: bannerUrl },
      })
    }

    results.push({
      username: artist.username,
      releasesUpdated,
      archiveItemsUpdated,
      bannerUpdated: Boolean(bannerUrl),
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        artists: results.length,
        totalReleaseArtUpdated: results.reduce((n, r) => n + r.releasesUpdated, 0),
        totalArchiveArtUpdated: results.reduce((n, r) => n + r.archiveItemsUpdated, 0),
        results,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
