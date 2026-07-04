// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { FFMPEG_IMAGE } from './docker-streaming.js'

const execAsync = promisify(exec)

/** Fixed canvas size for the multistream mirror's baked-in video track. */
export const COVER_WIDTH = 1280
export const COVER_HEIGHT = 720

/** Fallback color (Tahti navy) used when a channel has no avatar to bake in. */
const FALLBACK_COLOR = '0x13294b'

export function coverImagePath(channelId: string): string {
  return `/cover-cache/${channelId}/cover.jpg`
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Builds the `docker run` command that (re)generates a channel's cover-cache JPEG.
 * Pulled out of ensureCoverImage as a pure function so the command shape can be
 * unit-tested without actually shelling out — same split as
 * buildEdgeEncoderDockerCommand/spawnEdgeEncoder in edge-encoder.ts.
 */
export function buildCoverCacheDockerCommand(
  channelId: string,
  avatarUrl: string | null,
  coverCacheVolume: string,
): string {
  const coverDir = `/cover-cache/${channelId}`
  const outPath = coverImagePath(channelId)
  const scaleFilter = `scale=${COVER_WIDTH}:${COVER_HEIGHT}:force_original_aspect_ratio=increase,crop=${COVER_WIDTH}:${COVER_HEIGHT}`

  const innerScript = avatarUrl
    ? `mkdir -p ${coverDir} && ffmpeg -y -i "$AVATAR_URL" -vf "${scaleFilter}" -frames:v 1 -update 1 ${outPath}`
    : `mkdir -p ${coverDir} && ffmpeg -y -f lavfi -i "color=c=${FALLBACK_COLOR}:s=${COVER_WIDTH}x${COVER_HEIGHT}" -frames:v 1 -update 1 ${outPath}`

  return [
    'docker run --rm',
    ...(avatarUrl ? [`-e AVATAR_URL=${shellQuote(avatarUrl)}`] : []),
    `-v ${coverCacheVolume}:/cover-cache`,
    FFMPEG_IMAGE,
    'sh',
    '-c',
    shellQuote(innerScript),
  ].join(' ')
}

/**
 * Populates the shared cover-cache volume with a fixed-size JPEG for a channel's
 * RTMP mirror video track — the orchestrator container has no ffmpeg binary itself
 * (only docker-cli), so this runs a short-lived ffmpeg container against the same
 * named volume the Liquidsoap channel container mounts, mirroring the edge-encoder
 * / recorder pattern instead of touching the volume from the orchestrator's own fs.
 */
export async function ensureCoverImage(
  channelId: string,
  avatarUrl: string | null,
  coverCacheVolume: string,
): Promise<void> {
  const cmd = buildCoverCacheDockerCommand(channelId, avatarUrl, coverCacheVolume)

  try {
    await execAsync(cmd)
  } catch (err) {
    console.error(`[orchestrator] cover image generation failed for channel ${channelId}:`, err)
    if (avatarUrl) {
      // Avatar fetch/decode failed (dead URL, unsupported format, network hiccup) —
      // fall back to the solid-color card so the mirror never ships with a missing file.
      await ensureCoverImage(channelId, null, coverCacheVolume)
    }
  }
}
