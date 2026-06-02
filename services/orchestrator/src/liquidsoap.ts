// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { exec } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { prisma } from '@tahti/db'

const execAsync = promisify(exec)

const LIQUIDSOAP_IMAGE =
  process.env.LIQUIDSOAP_IMAGE ?? 'savonet/liquidsoap:v2.2.5'
const TEMPLATE_PATH =
  process.env.LIQUIDSOAP_TEMPLATE ?? '/srv/liquidsoap-channel.liq.template'
const HLS_VOLUME = process.env.HLS_VOLUME ?? 'tahti_hls_shared'
const RECORDINGS_VOLUME = process.env.RECORDINGS_VOLUME ?? 'tahti_recordings_shared'
const API_URL = process.env.API_URL ?? 'http://api:3001'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? 'dev-internal-secret-change-in-prod'

// Track running containers: channelId → containerName
const activeChannels = new Map<string, string>()

export function getActiveChannels(): string[] {
  return [...activeChannels.keys()]
}

export async function spawnChannel(
  channelId: string,
  slug: string,
  broadcastId: string,
): Promise<void> {
  if (activeChannels.has(channelId)) {
    // Already running — no-op
    return
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      slug: true,
      liveSourcePass: true,
      fallbackMode: true,
    },
  })

  if (!channel) throw new Error(`Channel ${channelId} not found`)

  // Render Liquidsoap config from template
  const templateRaw = await readFile(TEMPLATE_PATH, 'utf8')
  const config = templateRaw
    .replace(/\{\{CHANNEL_ID\}\}/g, channelId)
    .replace(/\{\{LIVE_SOURCE_PASSWORD\}\}/g, channel.liveSourcePass)
    .replace(/\{\{HARBOR_INPUT_PORT\}\}/g, '8001')
    .replace(/\{\{HARBOR_NOWPLAYING_PORT\}\}/g, '8002')
    .replace(/\{\{FALLBACK_MODE\}\}/g, channel.fallbackMode)
    .replace(/\{\{API_URL\}\}/g, API_URL)
    .replace(/\{\{RTMP_TARGETS\}\}[\s\S]*?\{\{\/RTMP_TARGETS\}\}/g, '')

  const configPath = `/tmp/liquidsoap-${channelId}.liq`
  await writeFile(configPath, config)

  const containerName = `tahti-channel-${slug}`

  const cmd = [
    'docker run -d',
    `--name ${containerName}`,
    '--restart unless-stopped',
    `-v ${HLS_VOLUME}:/hls`,
    `-v ${RECORDINGS_VOLUME}:/recordings`,
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

export async function stopChannel(channelId: string): Promise<void> {
  const containerName = activeChannels.get(channelId)
  if (!containerName) return

  try {
    await execAsync(`docker stop ${containerName}`)
    await execAsync(`docker rm ${containerName}`)
  } catch (err) {
    // Container may already be gone
    console.error(`[orchestrator] failed to stop ${containerName}:`, err)
  }

  activeChannels.delete(channelId)
}
