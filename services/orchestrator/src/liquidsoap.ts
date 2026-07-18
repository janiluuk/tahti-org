// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { exec } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { createDecipheriv } from 'node:crypto'
import { prisma } from '@tahti/db'
import type { BroadcastSource } from '@tahti/db'
import { spawnBroadcastRecorder, stopChannelRecorders, stopBroadcastRecorder } from './recorder.js'
import {
  spawnFingerprintIngest,
  stopChannelFingerprintIngest,
  stopFingerprintIngest,
} from './fingerprint-ingest.js'
import { ARCHIVE_CACHE_VOLUME, COVER_CACHE_VOLUME } from './docker-streaming.js'
import { spawnEdgeEncoder, stopChannelEdgeEncoders } from './edge-encoder.js'
import { ensureCoverImage, coverImagePath } from './cover-cache.js'
import { liveInputUrl } from './live-input.js'
import {
  LIQUIDSOAP_FADE_SEC,
  LIQUIDSOAP_TELNET_PORT,
  liquidsoapGracefulShutdownShell,
  liquidsoapGracefulShutdownWaitMs,
} from './liquidsoap-shutdown.js'

const execAsync = promisify(exec)

const LIQUIDSOAP_IMAGE = process.env.LIQUIDSOAP_IMAGE ?? 'savonet/liquidsoap:v2.2.5'
/** STREAM-010: allow Liquidsoap to flush the last HLS segment (4s × 4 segments). */
const LIQUIDSOAP_STOP_TIMEOUT_SEC = parseInt(process.env.LIQUIDSOAP_STOP_TIMEOUT_SEC ?? '20', 10)
const TEMPLATE_PATH = process.env.LIQUIDSOAP_TEMPLATE ?? '/srv/liquidsoap-channel.liq.template'
/** Always-on curated-rotation channels (Tahti Selects) — no live input, see liquidsoap-rotation.liq.template. */
const ROTATION_TEMPLATE_PATH =
  process.env.LIQUIDSOAP_ROTATION_TEMPLATE ?? '/srv/liquidsoap-rotation.liq.template'

export type LiquidsoapTemplateKind = 'channel' | 'rotation'
const HLS_VOLUME = process.env.HLS_VOLUME ?? 'tahti_stack_hls'
const RECORDINGS_VOLUME = process.env.RECORDINGS_VOLUME ?? 'tahti_recordings_shared'
/** Shared named volume for rendered per-channel Liquidsoap configs — see spawnLiquidsoapContainer. */
const LIQUIDSOAP_CONFIG_VOLUME =
  process.env.LIQUIDSOAP_CONFIG_VOLUME ?? 'tahti_stack_liquidsoap_configs'
/** Where LIQUIDSOAP_CONFIG_VOLUME is mounted inside *this* (orchestrator) container. */
const LIQUIDSOAP_CONFIG_MOUNT = process.env.LIQUIDSOAP_CONFIG_MOUNT ?? '/liquidsoap-configs'
const API_URL = process.env.API_URL ?? 'http://api:3001'
const DOCKER_NETWORK = process.env.CHANNEL_NETWORK ?? 'tahti-stack_default'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? 'dev-internal-secret-change-in-prod'

function decryptKey(enc: string): string {
  const hex =
    process.env.RTMP_KEY_ENC_KEY ??
    'dev0000000000000000000000000000000000000000000000000000000000000'
  const key = Buffer.from(hex.slice(0, 64), 'hex')
  const buf = Buffer.from(enc, 'base64')
  const nonce = buf.subarray(0, 12)
  const tag = buf.subarray(buf.length - 16)
  const ct = buf.subarray(12, buf.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

/** Escape a display name for embedding in a Liquidsoap double-quoted string literal. */
export function escapeLiquidsoapString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

interface RtmpMirrorTarget {
  rtmpUrl: string
  streamKey: string
  alwaysMirror: boolean
}

/**
 * Renders one multistream RTMP output: the live/archive audio muxed with a video
 * track built from the channel's cover-cache image + title text. Verified against
 * savonet/liquidsoap:v2.2.5's actual API surface (video.add_image has no `duration`
 * arg; the mux call is `source.mux.video`, not `mux(...)`; the ffmpeg video format
 * key is `%video`, not `%video.raw` — all three differ from what an earlier,
 * never-wired-up draft of this block assumed).
 */
export function buildRtmpMirrorOutput(
  target: RtmpMirrorTarget,
  coverPath: string,
  titleText: string,
): string {
  const audioSource = target.alwaysMirror ? 'radio' : 'live_source'
  const escapedTitle = escapeLiquidsoapString(titleText)
  const videoSource = `video.add_text(color=0xffffff, size=28, x=20, y=628, "${escapedTitle}", video.add_image(file="${coverPath}", width=1280, height=720, blank()))`
  return `output.url(\n  url="${target.rtmpUrl}/${target.streamKey}",\n  fallible=true,\n  %ffmpeg(\n    format="flv",\n    %audio(codec="aac", b="128k", ar=44100, ac=2),\n    %video(codec="libx264", b="2500k", preset="veryfast", pixel_format="yuv420p", framerate=30)\n  ),\n  source.mux.video(video=${videoSource}, ${audioSource})\n)`
}

// Track running containers: channelId → containerName
const activeChannels = new Map<string, string>()

export function getActiveChannels(): string[] {
  return [...activeChannels.keys()]
}

export async function spawnLiquidsoapContainer(
  channelId: string,
  slug: string,
  broadcastId: string,
  source: BroadcastSource = 'ICECAST',
  templateKind: LiquidsoapTemplateKind = 'channel',
): Promise<void> {
  if (activeChannels.has(channelId)) {
    return
  }

  const templatePath = templateKind === 'rotation' ? ROTATION_TEMPLATE_PATH : TEMPLATE_PATH

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      slug: true,
      liveSourcePass: true,
      fallbackMode: true,
      liveInputOverrideSlug: true,
      rtmpTargets: {
        where: { enabled: true },
        select: { provider: true, rtmpUrl: true, streamKeyEnc: true, alwaysMirror: true },
      },
      user: { select: { displayName: true, avatarUrl: true } },
    },
  })

  if (!channel) throw new Error(`Channel ${channelId} not found`)

  // Tahti Radio relaying a booked artist's live source during their slot (or any
  // future "one channel's Liquidsoap reads another's mount" need) — see
  // Channel.liveInputOverrideSlug. Falls through to the channel's own slug/mount
  // for every regular channel (override is null), matching prior behavior exactly.
  const inputUrl = liveInputUrl(source, channel.liveInputOverrideSlug ?? slug)

  // Decrypt RTMP stream keys
  const targets = channel.rtmpTargets.map((t) => ({
    provider: t.provider,
    rtmpUrl: t.rtmpUrl,
    streamKey: decryptKey(t.streamKeyEnc),
    alwaysMirror: t.alwaysMirror,
  }))

  // Multistream mirrors need a video track (YouTube/Twitch reject/flag audio-only
  // RTMP) — bake the channel's cover art + title into a static video frame. Only
  // populate the cache when there's actually a mirror target enabled.
  if (targets.length > 0) {
    await ensureCoverImage(channelId, channel.user.avatarUrl, COVER_CACHE_VOLUME)
  }

  // Render Liquidsoap config from template
  const templateRaw = await readFile(templatePath, 'utf8')
  let config = templateRaw
    .replace(/\{\{CHANNEL_ID\}\}/g, channelId)
    .replace(/\{\{LIVE_INPUT_URL\}\}/g, inputUrl)
    .replace(/\{\{ICECAST_LIVE_URL\}\}/g, inputUrl)
    .replace(/\{\{LIVE_SOURCE_PASSWORD\}\}/g, channel.liveSourcePass)
    .replace(/\{\{HARBOR_NOWPLAYING_PORT\}\}/g, '8002')
    .replace(/\{\{FALLBACK_MODE\}\}/g, channel.fallbackMode)
    .replace(/\{\{API_URL\}\}/g, API_URL)
    .replace(/\{\{LIQUIDSOAP_TELNET_PORT\}\}/g, String(LIQUIDSOAP_TELNET_PORT))
    .replace(/\{\{LIQUIDSOAP_FADE_SEC\}\}/g, String(LIQUIDSOAP_FADE_SEC))

  if (targets.length === 0) {
    // Strip the entire RTMP_TARGETS block
    config = config.replace(/\{\{#RTMP_TARGETS\}\}[\s\S]*?\{\{\/RTMP_TARGETS\}\}/g, '')
  } else {
    // Replace the template block with rendered outputs — each target gets its own
    // video source built from the shared cover-cache image (cheap: it's a static
    // decoded-once image, see cover-cache.ts) with the channel's display name
    // overlaid. See buildRtmpMirrorOutput for the Liquidsoap API details.
    const coverPath = coverImagePath(channelId)
    const rtmpBlock = targets
      .map((t) => buildRtmpMirrorOutput(t, coverPath, channel.user.displayName))
      .join('\n\n')
    config = config.replace(/\{\{#RTMP_TARGETS\}\}[\s\S]*?\{\{\/RTMP_TARGETS\}\}/g, rtmpBlock)
  }

  const configFileName = `liquidsoap-${channelId}.liq`
  // Written through the orchestrator's own mount of the shared named volume — but
  // the `docker run` below reaches the HOST's dockerd via the mounted socket, so its
  // bind-mount source must be a host path, not a path inside this container. Resolve
  // the volume's real host directory rather than reusing this container-local path.
  await writeFile(`${LIQUIDSOAP_CONFIG_MOUNT}/${configFileName}`, config)
  const { stdout: volumeMountpoint } = await execAsync(
    `docker volume inspect ${LIQUIDSOAP_CONFIG_VOLUME} --format '{{ .Mountpoint }}'`,
  )
  const hostConfigPath = `${volumeMountpoint.trim()}/${configFileName}`

  const containerName = `tahti-channel-${slug}`

  const cmd = [
    'docker run -d',
    `--name ${containerName}`,
    `--network ${DOCKER_NETWORK}`,
    '--restart unless-stopped',
    `-v ${HLS_VOLUME}:/hls`,
    `-v ${RECORDINGS_VOLUME}:/recordings`,
    `-v ${ARCHIVE_CACHE_VOLUME}:/archive-cache`,
    `-v ${COVER_CACHE_VOLUME}:/cover-cache`,
    `-v ${hostConfigPath}:/etc/liquidsoap/channel.liq:ro`,
    `-e CHANNEL_ID=${channelId}`,
    `-e BROADCAST_ID=${broadcastId}`,
    `-e API_URL=${API_URL}`,
    `-e INTERNAL_SECRET=${INTERNAL_SECRET}`,
    LIQUIDSOAP_IMAGE,
    'liquidsoap /etc/liquidsoap/channel.liq',
  ].join(' ')

  await execAsync(cmd)
  activeChannels.set(channelId, containerName)
}

/** Ensure edge encoder (RTMP) + Liquidsoap + ffmpeg recorder for a live broadcast. */
export async function spawnChannel(
  channelId: string,
  slug: string,
  broadcastId: string,
  templateKind: LiquidsoapTemplateKind = 'channel',
): Promise<void> {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: {
      source: true,
      channel: { select: { rtmpStreamKey: true } },
    },
  })
  const source = broadcast?.source ?? 'ICECAST'

  if (source === 'RTMP') {
    await spawnEdgeEncoder(channelId, slug, broadcast?.channel.rtmpStreamKey)
  }

  await spawnLiquidsoapContainer(channelId, slug, broadcastId, source, templateKind)

  // Rotation channels never publish to the Icecast /live/<slug> mount the recorder
  // and fingerprint-ingest read from (no live source ever connects) — skip both.
  if (templateKind === 'rotation') return

  await spawnBroadcastRecorder(
    channelId,
    slug,
    broadcastId,
    source,
    broadcast?.channel.rtmpStreamKey,
  )

  await spawnFingerprintIngest({
    channelId,
    slug,
    broadcastId,
    source,
    rtmpStreamKey: broadcast?.channel.rtmpStreamKey,
    apiUrl: API_URL,
    internalSecret: INTERNAL_SECRET,
  })
}

export async function stopLiquidsoapContainer(channelId: string): Promise<void> {
  const containerName = activeChannels.get(channelId)
  if (!containerName) return

  try {
    await requestLiquidsoapGracefulShutdown(containerName)
    await execAsync(`docker stop -t ${LIQUIDSOAP_STOP_TIMEOUT_SEC} ${containerName}`)
    await execAsync(`docker rm ${containerName}`)
  } catch (err) {
    console.error(`[orchestrator] failed to stop ${containerName}:`, err)
  }

  activeChannels.delete(channelId)
}

/** STREAM-010: telnet graceful_shutdown → fade → then docker stop. */
export async function requestLiquidsoapGracefulShutdown(containerName: string): Promise<void> {
  try {
    await execAsync(liquidsoapGracefulShutdownShell(containerName))
    await new Promise((resolve) => setTimeout(resolve, liquidsoapGracefulShutdownWaitMs()))
  } catch (err) {
    console.warn(`[orchestrator] graceful shutdown skipped for ${containerName}:`, err)
  }
}

export async function stopChannel(channelId: string): Promise<void> {
  await stopLiquidsoapContainer(channelId)
  await stopChannelRecorders(channelId)
  await stopChannelFingerprintIngest(channelId)
  await stopChannelEdgeEncoders(channelId)
}

export { stopBroadcastRecorder, stopFingerprintIngest }
