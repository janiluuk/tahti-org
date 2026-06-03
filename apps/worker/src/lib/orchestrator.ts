// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'http://localhost:3003'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? 'dev-internal-secret-change-in-prod'

/** Ask the orchestrator to stop Liquidsoap for a channel (M20 weekly cap enforcement). */
export async function stopOrchestratorChannel(channelId: string): Promise<void> {
  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelId }),
    })
    if (!res.ok) {
      console.warn(`[worker] orchestrator stop ${channelId}: HTTP ${res.status}`)
    }
  } catch (err) {
    console.warn(`[worker] orchestrator stop ${channelId} failed:`, err)
  }
}
