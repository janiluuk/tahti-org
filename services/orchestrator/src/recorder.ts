// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { BroadcastSource } from '@tahti/db'
import { edgeEncoderRelayUrl } from './edge-encoder.js'
import {
  DOCKER_NETWORK,
  FFMPEG_IMAGE,
  ICECAST_BASE_URL,
  RECORDINGS_VOLUME,
} from './docker-streaming.js'

const execAsync = promisify(exec)

export {
  FFMPEG_IMAGE,
  RECORDINGS_VOLUME,
  ICECAST_BASE_URL,
  DOCKER_NETWORK,
} from './docker-streaming.js'

/** Predictable WAV path written by the ffmpeg sidecar (STREAM-004). */
export function broadcastRecordingPath(channelId: string, broadcastId: string): string {
  return `/recordings/${channelId}/broadcast-${broadcastId}.wav`
}

export function buildRecorderDockerCommand(opts: {
  containerName: string
  channelId: string
  broadcastId: string
  inputUrl: string
}): string {
  const outputPath = broadcastRecordingPath(opts.channelId, opts.broadcastId)

  return [
    'docker run -d',
    `--name ${opts.containerName}`,
    `--network ${DOCKER_NETWORK}`,
    '--restart=no',
    `-v ${RECORDINGS_VOLUME}:/recordings`,
    FFMPEG_IMAGE,
    'ffmpeg',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-reconnect',
    '1',
    '-reconnect_streamed',
    '1',
    '-reconnect_delay_max',
    '5',
    '-i',
    opts.inputUrl,
    '-acodec',
    'pcm_s24le',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-y',
    outputPath,
  ].join(' ')
}

// broadcastId → sidecar metadata
const activeRecorders = new Map<string, { containerName: string; channelId: string }>()

export function getActiveRecorders(): string[] {
  return [...activeRecorders.keys()]
}

export function recorderContainerName(slug: string, broadcastId: string): string {
  const short = broadcastId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
  return `tahti-recorder-${slug}-${short}`
}

async function removeContainer(containerName: string): Promise<void> {
  try {
    await execAsync(`docker rm -f ${containerName}`)
  } catch {
    // already gone
  }
}

export function recorderInputUrl(
  source: BroadcastSource,
  slug: string,
  _rtmpStreamKey?: string | null,
): string {
  if (source === 'RTMP') {
    // Normalized feed from edge encoder (spawned before recorder)
    return edgeEncoderRelayUrl(slug)
  }
  // ICECAST and WEBRTC (relay TBD) — Liquidsoap harbor mount
  return `${ICECAST_BASE_URL}/live/${slug}`
}

/** STREAM-004: ffmpeg sidecar reads ingest directly — survives Liquidsoap restarts. */
export async function spawnBroadcastRecorder(
  channelId: string,
  slug: string,
  broadcastId: string,
  source: BroadcastSource,
  rtmpStreamKey?: string | null,
): Promise<void> {
  if (activeRecorders.has(broadcastId)) return

  const containerName = recorderContainerName(slug, broadcastId)
  await removeContainer(containerName)

  const cmd = buildRecorderDockerCommand({
    containerName,
    channelId,
    broadcastId,
    inputUrl: recorderInputUrl(source, slug, rtmpStreamKey),
  })
  await execAsync(cmd)
  activeRecorders.set(broadcastId, { containerName, channelId })
}

export async function stopBroadcastRecorder(broadcastId: string): Promise<void> {
  const entry = activeRecorders.get(broadcastId)
  if (!entry) return
  await removeContainer(entry.containerName)
  activeRecorders.delete(broadcastId)
}

/** Stop all recorder sidecars for a channel (cap enforcement / full teardown). */
export async function stopChannelRecorders(channelId: string): Promise<void> {
  const pending = [...activeRecorders.entries()]
  for (const [broadcastId, entry] of pending) {
    if (entry.channelId !== channelId) continue
    await removeContainer(entry.containerName)
    activeRecorders.delete(broadcastId)
  }
}
