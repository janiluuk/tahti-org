// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { exec } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { createDecipheriv } from 'node:crypto'
import { prisma } from '@tahti/db'
import type { BroadcastSource } from '@tahti/db'
import { spawnBroadcastRecorder, stopChannelRecorders, stopBroadcastRecorder } from './recorder.js'
import { ARCHIVE_CACHE_VOLUME } from './docker-streaming.js'
import { spawnEdgeEncoder, stopChannelEdgeEncoders } from './edge-encoder.js'
import { liveInputUrl } from './live-input.js'

const execAsync = promisify(exec)

const LIQUIDSOAP_IMAGE = process.env.LIQUIDSOAP_IMAGE ?? 'savonet/liquidsoap:v2.2.5'
const TEMPLATE_PATH = process.env.LIQUIDSOAP_TEMPLATE ?? '/srv/liquidsoap-channel.liq.template'
const HLS_VOLUME = process.env.HLS_VOLUME ?? 'tahti_stack_hls'
const RECORDINGS_VOLUME = process.env.RECORDINGS_VOLUME ?? 'tahti_recordings_shared'
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
): Promise<void> {
  if (activeChannels.has(channelId)) {
    return
  }

  const inputUrl = liveInputUrl(source, slug)

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      slug: true,
      liveSourcePass: true,
      fallbackMode: true,
      rtmpTargets: {
        where: { enabled: true },
        select: { provider: true, rtmpUrl: true, streamKeyEnc: true, alwaysMirror: true },
      },
    },
  })

  if (!channel) throw new Error(`Channel ${channelId} not found`)

  // Decrypt RTMP stream keys
  const targets = channel.rtmpTargets.map((t) => ({
    provider: t.provider,
    rtmpUrl: t.rtmpUrl,
    streamKey: decryptKey(t.streamKeyEnc),
    alwaysMirror: t.alwaysMirror,
  }))

  // Render Liquidsoap config from template
  const templateRaw = await readFile(TEMPLATE_PATH, 'utf8')
  let config = templateRaw
    .replace(/\{\{CHANNEL_ID\}\}/g, channelId)
    .replace(/\{\{LIVE_INPUT_URL\}\}/g, inputUrl)
    .replace(/\{\{ICECAST_LIVE_URL\}\}/g, inputUrl)
    .replace(/\{\{LIVE_SOURCE_PASSWORD\}\}/g, channel.liveSourcePass)
    .replace(/\{\{HARBOR_NOWPLAYING_PORT\}\}/g, '8002')
    .replace(/\{\{FALLBACK_MODE\}\}/g, channel.fallbackMode)
    .replace(/\{\{API_URL\}\}/g, API_URL)

  if (targets.length === 0) {
    // Strip the entire RTMP_TARGETS block
    config = config.replace(/\{\{#RTMP_TARGETS\}\}[\s\S]*?\{\{\/RTMP_TARGETS\}\}/g, '')
  } else {
    // Replace the template block with rendered outputs
    const rtmpBlock = targets
      .map((t) => {
        const alwaysMirrorFlag = t.alwaysMirror ? '1' : ''
        return `output.url(\n  url="${t.rtmpUrl}/${t.streamKey}",\n  fallible=true,\n  %ffmpeg(format="flv", %audio(codec="aac", b="128k")),\n  ${alwaysMirrorFlag ? 'radio' : 'live_source'}\n)`
      })
      .join('\n\n')
    config = config.replace(/\{\{#RTMP_TARGETS\}\}[\s\S]*?\{\{\/RTMP_TARGETS\}\}/g, rtmpBlock)
  }

  const configPath = `/tmp/liquidsoap-${channelId}.liq`
  await writeFile(configPath, config)

  const containerName = `tahti-channel-${slug}`

  const cmd = [
    'docker run -d',
    `--name ${containerName}`,
    `--network ${DOCKER_NETWORK}`,
    '--restart unless-stopped',
    `-v ${HLS_VOLUME}:/hls`,
    `-v ${RECORDINGS_VOLUME}:/recordings`,
    `-v ${ARCHIVE_CACHE_VOLUME}:/archive-cache`,
    `-v ${configPath}:/etc/liquidsoap/channel.liq:ro`,
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

  await spawnLiquidsoapContainer(channelId, slug, broadcastId, source)

  await spawnBroadcastRecorder(
    channelId,
    slug,
    broadcastId,
    source,
    broadcast?.channel.rtmpStreamKey,
  )
}

export async function stopLiquidsoapContainer(channelId: string): Promise<void> {
  const containerName = activeChannels.get(channelId)
  if (!containerName) return

  try {
    await execAsync(`docker stop ${containerName}`)
    await execAsync(`docker rm ${containerName}`)
  } catch (err) {
    console.error(`[orchestrator] failed to stop ${containerName}:`, err)
  }

  activeChannels.delete(channelId)
}

export async function stopChannel(channelId: string): Promise<void> {
  await stopLiquidsoapContainer(channelId)
  await stopChannelRecorders(channelId)
  await stopChannelEdgeEncoders(channelId)
}

export { stopBroadcastRecorder }
