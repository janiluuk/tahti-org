// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

/** Ensure per-channel Liquidsoap is running (HLS + archive fallback + multistream). */
export async function spawnChannelLiquidsoap(
  channelId: string,
  slug: string,
  broadcastId: string,
): Promise<void> {
  const res = await fetch(`${config.orchestratorUrl}/spawn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.internalSecret}`,
    },
    body: JSON.stringify({ channelId, slug, broadcastId }),
  })
  if (!res.ok) {
    throw new Error(`Orchestrator returned ${res.status}`)
  }
}

export async function restartChannelLiquidsoap(
  channelId: string,
  slug: string,
  broadcastId: string,
): Promise<void> {
  const res = await fetch(`${config.orchestratorUrl}/restart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.internalSecret}`,
    },
    body: JSON.stringify({ channelId, slug, broadcastId }),
  })
  if (!res.ok) {
    throw new Error(`Orchestrator restart returned ${res.status}`)
  }
}
