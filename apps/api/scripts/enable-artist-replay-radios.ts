// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Enable 24/7 replay radio for artist channels:
 *   - Assign a random non-MINIMAL visual preset (when still MINIMAL)
 *   - Ensure fallbackEnabled
 *   - Attach demo tracks from Tahti Selects when the channel has none
 *   - Flag up to 2 READY tracks as isFallback so rotation has a pool
 *
 * Default scope: @beta.tahti.live artists (and displayName containing "[BETA]").
 * Pass `--all` for every non-system channel. Pass `--force-visual` to re-roll
 * presets even when already set.
 *
 * Run (local):  pnpm --filter @tahti/api exec tsx scripts/enable-artist-replay-radios.ts
 * Run (stack):  docker compose run --rm api tsx apps/api/scripts/enable-artist-replay-radios.ts
 * Run (prod):   ssh vimage → docker compose exec api tsx apps/api/scripts/enable-artist-replay-radios.ts
 */

import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG, TAHTI_SELECTS_SLUG, VISUAL_PRESETS, type VisualPreset } from '@tahti/shared'

const SYSTEM_SLUGS = new Set([TAHTI_RADIO_SLUG, TAHTI_SELECTS_SLUG])
const AMBIENT_PRESETS = VISUAL_PRESETS.filter((p): p is VisualPreset => p !== 'MINIMAL')
const TRACKS_PER_CHANNEL = 2

function pickPreset(seed: string): VisualPreset {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AMBIENT_PRESETS[h % AMBIENT_PRESETS.length]!
}

async function main() {
  const forceVisual = process.argv.includes('--force-visual')
  const allArtists = process.argv.includes('--all')

  const sourceTracks = await prisma.archiveItem.findMany({
    where: { channel: { slug: TAHTI_SELECTS_SLUG }, status: 'READY', isPublic: true },
    select: {
      title: true,
      artistName: true,
      mp3Key: true,
      flacKey: true,
      bannerUrl: true,
      durationSec: true,
      fileSizeBytes: true,
      sourceFormat: true,
      sourceBitrateKbps: true,
      license: true,
      qualityBadge: true,
      commentary: true,
    },
  })
  if (sourceTracks.length === 0) {
    throw new Error('No READY/public Tahti Selects tracks found to attach as demo tracks')
  }

  const channels = await prisma.channel.findMany({
    where: {
      slug: { notIn: [...SYSTEM_SLUGS] },
      ...(allArtists
        ? {}
        : {
            user: {
              OR: [
                { email: { endsWith: '@beta.tahti.live' } },
                { displayName: { contains: '[BETA]' } },
              ],
            },
          }),
    },
    select: {
      id: true,
      slug: true,
      fallbackEnabled: true,
      visualPreset: true,
      user: { select: { displayName: true } },
      archiveItems: {
        where: { status: 'READY' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, isFallback: true },
      },
    },
    orderBy: { slug: 'asc' },
  })

  let trackCursor = 0
  const results: Array<{
    slug: string
    visualPreset: VisualPreset
    tracksAttached: number
    fallbackFlagged: number
    fallbackEnabled: boolean
  }> = []

  for (const channel of channels) {
    const visualPreset =
      forceVisual || channel.visualPreset === 'MINIMAL'
        ? pickPreset(channel.slug)
        : (channel.visualPreset as VisualPreset)

    let tracksAttached = 0
    let items: Array<{ id: string; isFallback: boolean }> = [...channel.archiveItems]

    while (items.length < TRACKS_PER_CHANNEL) {
      const source = sourceTracks[trackCursor % sourceTracks.length]!
      trackCursor++
      const order = items.length
      const row = await prisma.archiveItem.create({
        data: {
          channelId: channel.id,
          title: source.title,
          artistName: source.artistName,
          status: 'READY',
          isPublic: true,
          isFallback: true,
          fallbackOrder: order,
          license: source.license,
          qualityBadge: source.qualityBadge,
          mp3Key: source.mp3Key,
          flacKey: source.flacKey,
          bannerUrl: source.bannerUrl,
          durationSec: source.durationSec,
          fileSizeBytes: source.fileSizeBytes,
          sourceFormat: source.sourceFormat,
          sourceBitrateKbps: source.sourceBitrateKbps,
          commentary: `Demo track for replay radio — ${source.commentary ?? `originally credited to ${source.artistName}`}`,
        },
        select: { id: true, isFallback: true },
      })
      items.push(row)
      tracksAttached++
    }

    let fallbackFlagged = items.filter((t) => t.isFallback).length
    if (fallbackFlagged < TRACKS_PER_CHANNEL) {
      const toFlag = items.filter((t) => !t.isFallback).slice(0, TRACKS_PER_CHANNEL - fallbackFlagged)
      for (let i = 0; i < toFlag.length; i++) {
        await prisma.archiveItem.update({
          where: { id: toFlag[i]!.id },
          data: { isFallback: true, fallbackOrder: fallbackFlagged + i },
        })
        toFlag[i]!.isFallback = true
        fallbackFlagged++
      }
    }

    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        fallbackEnabled: true,
        ...(visualPreset !== channel.visualPreset ? { visualPreset } : {}),
      },
    })

    results.push({
      slug: channel.slug,
      visualPreset,
      tracksAttached,
      fallbackFlagged: fallbackFlagged || alreadyFlagged,
      fallbackEnabled: true,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: allArtists ? 'all-artists' : 'beta',
        forceVisual,
        total: results.length,
        presets: Object.fromEntries(
          AMBIENT_PRESETS.map((p) => [p, results.filter((r) => r.visualPreset === p).length]),
        ),
        tracksAttached: results.reduce((n, r) => n + r.tracksAttached, 0),
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
