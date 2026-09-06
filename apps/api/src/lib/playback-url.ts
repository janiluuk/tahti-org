// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { soundPlaybackKey, type TahtiSelectsGalleryItem } from '@tahti/shared'
import { presignedGetUrl } from './minio.js'
import { resolvePlaybackGateStatus, type PlaybackGateStatus } from './purchase-tiers.js'

export type PlaybackGatePayload = {
  reason: 'SUBSCRIBERS_ONLY' | 'PURCHASE'
  tierId?: string
}

export type GatedPlaybackInput = {
  playbackKey: string | null
  artistUserId: string
  accessMode: 'FREE' | 'SUBSCRIBERS_ONLY' | 'PURCHASE' | null | undefined
  purchaseTierId?: string | null
  viewerUserId: string | null
  ttlSec?: number
}

export function playbackGatePayload(
  status: Extract<PlaybackGateStatus, { allowed: false }>,
): PlaybackGatePayload {
  return {
    reason: status.reason,
    ...(status.tierId ? { tierId: status.tierId } : {}),
  }
}

export function playbackForbiddenBody(status: Extract<PlaybackGateStatus, { allowed: false }>) {
  return {
    error:
      status.reason === 'PURCHASE'
        ? 'Buy this track (or subscribe) to play'
        : 'Subscribe to this artist to play',
    gate: status.reason,
    ...(status.tierId ? { tierId: status.tierId } : {}),
  }
}

/** Presign only after the viewer is entitled — never mint a URL for a gated miss. */
export async function resolveGatedPlaybackUrl(
  prisma: PrismaClient,
  args: GatedPlaybackInput,
): Promise<{ url: string | null; gate: PlaybackGatePayload | null }> {
  const status = await resolvePlaybackGateStatus(
    prisma,
    {
      artistUserId: args.artistUserId,
      accessMode: args.accessMode ?? 'FREE',
      purchaseTierId: args.purchaseTierId ?? null,
    },
    args.viewerUserId,
  )
  if (!status.allowed) {
    return { url: null, gate: playbackGatePayload(status) }
  }
  const url = args.playbackKey ? await presignedGetUrl(args.playbackKey, args.ttlSec ?? 3600) : null
  return { url, gate: null }
}

export type GallerySoundRow = {
  id: string
  title: string
  artistName: string | null
  bannerUrl: string | null
  durationSec: number | null
  mp3Key: string | null
  flacKey: string | null
  accessMode: 'FREE' | 'SUBSCRIBERS_ONLY' | 'PURCHASE'
  purchaseTierId: string | null
  channel: {
    slug: string
    userId: string
    user: { username: string; displayName: string }
  }
}

export async function toGatedGalleryItem(
  prisma: PrismaClient,
  item: GallerySoundRow,
  viewerUserId: string | null,
): Promise<TahtiSelectsGalleryItem> {
  const { url, gate } = await resolveGatedPlaybackUrl(prisma, {
    playbackKey: soundPlaybackKey(item),
    artistUserId: item.channel.userId,
    accessMode: item.accessMode,
    purchaseTierId: item.purchaseTierId,
    viewerUserId,
  })
  return {
    soundId: item.id,
    title: item.title,
    artistName: item.artistName ?? item.channel.user.displayName,
    artistUsername: item.artistName ? null : item.channel.user.username,
    channelSlug: item.channel.slug,
    bannerUrl: item.bannerUrl,
    durationSec: item.durationSec,
    audioUrl: url,
    gate,
  }
}
