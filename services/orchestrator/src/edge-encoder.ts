// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { FFMPEG_IMAGE, DOCKER_NETWORK, RTMP_INGEST_URL } from './docker-streaming.js'

const execAsync = promisify(exec)

export const EDGE_ENCODER_PORT = parseInt(process.env.EDGE_ENCODER_PORT ?? '8090', 10)
export const EDGE_ENCODER_BITRATE = process.env.EDGE_ENCODER_BITRATE ?? '192k'

/** One edge encoder per channel — stable URL for Liquidsoap reconnect (STREAM-002). */
export function edgeEncoderContainerName(slug: string): string {
  return `tahti-edge-${slug}`
}

export function rtmpIngestUrl(slug: string, rtmpStreamKey?: string | null): string {
  const streamName = rtmpStreamKey ? `${slug}__${rtmpStreamKey}` : slug
  return `${RTMP_INGEST_URL}/live/${streamName}`
}

/** Normalized MP3 HTTP relay Liquidsoap and recorder read (RTMP path only). */
export function edgeEncoderRelayUrl(slug: string): string {
  return `http://${edgeEncoderContainerName(slug)}:${EDGE_ENCODER_PORT}/stream`
}

export function buildEdgeEncoderDockerCommand(opts: {
  containerName: string
  rtmpInputUrl: string
}): string {
  return [
    'docker run -d',
    `--name ${opts.containerName}`,
    `--network ${DOCKER_NETWORK}`,
    '--restart=no',
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
    opts.rtmpInputUrl,
    '-acodec',
    'libmp3lame',
    '-b:a',
    EDGE_ENCODER_BITRATE,
    '-ar',
    '48000',
    '-ac',
    '2',
    '-f',
    'mp3',
    '-listen',
    '1',
    '-http_persistent',
    '1',
    `http://0.0.0.0:${EDGE_ENCODER_PORT}/stream`,
  ].join(' ')
}

const activeEdgeEncoders = new Map<string, { containerName: string; channelId: string }>()

export function getActiveEdgeEncoders(): string[] {
  return [...activeEdgeEncoders.keys()]
}

async function removeContainer(containerName: string): Promise<void> {
  try {
    await execAsync(`docker rm -f ${containerName}`)
  } catch {
    // already gone
  }
}

/** STREAM-002: normalize RTMP → MP3 HTTP relay; holds OBS connection through Liquidsoap restarts. */
export async function spawnEdgeEncoder(
  channelId: string,
  slug: string,
  rtmpStreamKey?: string | null,
): Promise<void> {
  const containerName = edgeEncoderContainerName(slug)
  await removeContainer(containerName)

  const cmd = buildEdgeEncoderDockerCommand({
    containerName,
    rtmpInputUrl: rtmpIngestUrl(slug, rtmpStreamKey),
  })
  await execAsync(cmd)
  activeEdgeEncoders.set(channelId, { containerName, channelId })
}

export async function stopEdgeEncoder(channelId: string): Promise<void> {
  const entry = activeEdgeEncoders.get(channelId)
  if (!entry) return
  await removeContainer(entry.containerName)
  activeEdgeEncoders.delete(channelId)
}

export async function stopChannelEdgeEncoders(channelId: string): Promise<void> {
  await stopEdgeEncoder(channelId)
}
