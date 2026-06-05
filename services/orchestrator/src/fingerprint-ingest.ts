// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { BroadcastSource } from '@tahti/db'
import { DOCKER_NETWORK } from './docker-streaming.js'
import { recorderInputUrl } from './recorder.js'

const execAsync = promisify(exec)

export const FINGERPRINT_IMAGE = process.env.FINGERPRINT_IMAGE ?? 'alpine:3.20'
export const FINGERPRINT_INTERVAL_SEC = parseInt(process.env.FINGERPRINT_INTERVAL_SEC ?? '30', 10)
export const FINGERPRINT_WINDOW_SEC = parseInt(process.env.FINGERPRINT_WINDOW_SEC ?? '12', 10)

export function fingerprintContainerName(slug: string, broadcastId: string): string {
  const short = broadcastId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
  return `tahti-fp-${slug}-${short}`
}

function shellDoubleQuote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Shell loop: sample live ingest, fpcalc chromaprint, POST segments to API. */
export function buildFingerprintIngestShell(opts: {
  inputUrl: string
  broadcastId: string
  apiUrl: string
  internalSecret: string
  intervalSec?: number
  windowSec?: number
}): string {
  const interval = opts.intervalSec ?? FINGERPRINT_INTERVAL_SEC
  const window = opts.windowSec ?? FINGERPRINT_WINDOW_SEC

  return [
    'set -eu',
    'apk add --no-cache ffmpeg chromaprint curl >/dev/null',
    `INPUT_URL="${shellDoubleQuote(opts.inputUrl)}"`,
    `BROADCAST_ID="${shellDoubleQuote(opts.broadcastId)}"`,
    `API_URL="${shellDoubleQuote(opts.apiUrl.replace(/\/$/, ''))}"`,
    `INTERNAL_SECRET="${shellDoubleQuote(opts.internalSecret)}"`,
    `INTERVAL_SEC=${interval}`,
    `WINDOW_SEC=${window}`,
    'OFFSET=0',
    'while true; do',
    '  if ffmpeg -hide_banner -loglevel error -y -i "$INPUT_URL" -t "$WINDOW_SEC" -ac 1 -ar 44100 /tmp/w.wav 2>/dev/null; then',
    '    FP=$(fpcalc -json /tmp/w.wav 2>/dev/null | tr -d \'\\n\' | sed \'s/.*"fingerprint":"\\([^"]*\\)".*/\\1/\' | head -1)',
    '    if [ -n "$FP" ]; then',
    '      curl -sf -X POST -H "Authorization: Bearer $INTERNAL_SECRET" -H "Content-Type: application/json" \\',
    '        -d "{\\"offsetSec\\":$OFFSET,\\"durationSec\\":$WINDOW_SEC,\\"fingerprint\\":\\"$FP\\"}" \\',
    '        "$API_URL/internal/broadcast/$BROADCAST_ID/fingerprint-segment" || true',
    '    fi',
    '    rm -f /tmp/w.wav',
    '  fi',
    '  OFFSET=$((OFFSET + INTERVAL_SEC))',
    '  sleep "$INTERVAL_SEC"',
    'done',
  ].join('\n')
}

export function buildFingerprintIngestDockerCommand(opts: {
  containerName: string
  inputUrl: string
  broadcastId: string
  apiUrl: string
  internalSecret: string
}): string {
  const shell = buildFingerprintIngestShell(opts)

  return [
    'docker run -d',
    `--name ${opts.containerName}`,
    `--network ${DOCKER_NETWORK}`,
    '--restart=no',
    FINGERPRINT_IMAGE,
    'sh',
    '-c',
    JSON.stringify(shell),
  ].join(' ')
}

const activeFingerprintIngest = new Map<
  string,
  { containerName: string; channelId: string; broadcastId: string }
>()

export function getActiveFingerprintIngest(): string[] {
  return [...activeFingerprintIngest.keys()]
}

async function removeContainer(containerName: string): Promise<void> {
  try {
    await execAsync(`docker rm -f ${containerName}`)
  } catch {
    // already gone
  }
}

export async function spawnFingerprintIngest(opts: {
  channelId: string
  slug: string
  broadcastId: string
  source: BroadcastSource
  rtmpStreamKey?: string | null
  apiUrl: string
  internalSecret: string
}): Promise<void> {
  if (activeFingerprintIngest.has(opts.broadcastId)) return

  const containerName = fingerprintContainerName(opts.slug, opts.broadcastId)
  await removeContainer(containerName)

  const cmd = buildFingerprintIngestDockerCommand({
    containerName,
    inputUrl: recorderInputUrl(opts.source, opts.slug, opts.rtmpStreamKey),
    broadcastId: opts.broadcastId,
    apiUrl: opts.apiUrl,
    internalSecret: opts.internalSecret,
  })
  await execAsync(cmd)
  activeFingerprintIngest.set(opts.broadcastId, {
    containerName,
    channelId: opts.channelId,
    broadcastId: opts.broadcastId,
  })
}

export async function stopFingerprintIngest(broadcastId: string): Promise<void> {
  const entry = activeFingerprintIngest.get(broadcastId)
  if (!entry) return
  await removeContainer(entry.containerName)
  activeFingerprintIngest.delete(broadcastId)
}

export async function stopChannelFingerprintIngest(channelId: string): Promise<void> {
  const pending = [...activeFingerprintIngest.entries()]
  for (const [broadcastId, entry] of pending) {
    if (entry.channelId !== channelId) continue
    await removeContainer(entry.containerName)
    activeFingerprintIngest.delete(broadcastId)
  }
}
