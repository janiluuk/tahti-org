// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

export type LiquidsoapTemplateKind = 'channel' | 'rotation'

/** Ensure per-channel Liquidsoap is running (HLS + archive fallback + multistream). */
export async function spawnChannelLiquidsoap(
  channelId: string,
  slug: string,
  broadcastId: string,
  template: LiquidsoapTemplateKind = 'channel',
): Promise<void> {
  const res = await fetch(`${config.orchestratorUrl}/spawn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.internalSecret}`,
    },
    body: JSON.stringify({ channelId, slug, broadcastId, template }),
  })
  if (!res.ok) {
    throw new Error(`Orchestrator returned ${res.status}`)
  }
}

export async function restartChannelLiquidsoap(
  channelId: string,
  slug: string,
  broadcastId: string,
  template: LiquidsoapTemplateKind = 'channel',
): Promise<void> {
  const res = await fetch(`${config.orchestratorUrl}/restart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.internalSecret}`,
    },
    body: JSON.stringify({ channelId, slug, broadcastId, template }),
  })
  if (!res.ok) {
    throw new Error(`Orchestrator restart returned ${res.status}`)
  }
}

/** Manage panel transport controls — thin POST wrappers around the
 * orchestrator's telnet-backed endpoints. Throws on a non-2xx response
 * (including 404 when the channel isn't currently running) so the route
 * handler can translate it into the right HTTP status for the caller. */
async function postOrchestratorTransport(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${config.orchestratorUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.internalSecret}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = new Error(`Orchestrator ${path} returned ${res.status}`)
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }
}

export async function skipChannelTrack(channelId: string): Promise<void> {
  await postOrchestratorTransport('/skip', { channelId })
}

export async function playPreviousChannelTrack(channelId: string, url: string): Promise<void> {
  await postOrchestratorTransport('/previous', { channelId, url })
}

export async function pauseChannelRotation(channelId: string): Promise<void> {
  await postOrchestratorTransport('/pause', { channelId })
}

export async function resumeChannelRotation(channelId: string): Promise<void> {
  await postOrchestratorTransport('/resume', { channelId })
}

/** M20/M21: stop per-channel Liquidsoap (warn-only — channel may already be offline). */
export async function stopOrchestratorChannel(channelId: string): Promise<void> {
  try {
    const res = await fetch(`${config.orchestratorUrl}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.internalSecret}`,
      },
      body: JSON.stringify({ channelId }),
    })
    if (!res.ok) {
      console.warn(`[api] orchestrator /stop returned ${res.status} for ${channelId}`)
    }
  } catch (err) {
    console.warn(`[api] orchestrator /stop failed for ${channelId}:`, err)
  }
}
