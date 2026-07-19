// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const ORCHESTRATOR_URL = (process.env.ORCHESTRATOR_URL ?? 'http://localhost:3003').replace(
  /\/$/,
  '',
)
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? 'dev-internal-secret-change-in-prod'

async function orchestratorPost(
  path: string,
  body: Record<string, string>,
  opts?: { warnOnly?: boolean },
): Promise<boolean> {
  try {
    const res = await fetch(`${ORCHESTRATOR_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const msg = `Orchestrator ${path} returned ${res.status}`
      if (opts?.warnOnly) {
        console.warn(`[worker] ${msg}`)
        return false
      }
      throw new Error(msg)
    }
    return true
  } catch (err) {
    if (opts?.warnOnly) {
      console.warn(`[worker] orchestrator ${path} failed:`, err)
      return false
    }
    throw err
  }
}

/** M20 weekly cap enforcement — stop Liquidsoap for a channel. */
export async function stopOrchestratorChannel(channelId: string): Promise<void> {
  await orchestratorPost('/stop', { channelId }, { warnOnly: true })
}

/** STREAM-005: restart Liquidsoap after stale HLS segments. */
export async function restartChannelLiquidsoap(
  channelId: string,
  slug: string,
  broadcastId: string,
  template: 'channel' | 'rotation' = 'channel',
): Promise<void> {
  await orchestratorPost('/restart', { channelId, slug, broadcastId, template })
}

/** Idempotent — orchestrator no-ops if this channel's container is already tracked
 * (or already running under a different orchestrator process — see the Docker
 * reconciliation check in spawnLiquidsoapContainer). Returns whether the channel
 * is confirmed running, so callers can gate state on it. */
export async function spawnOrchestratorChannel(
  channelId: string,
  slug: string,
  broadcastId: string,
  template: 'channel' | 'rotation' = 'channel',
): Promise<boolean> {
  return orchestratorPost('/spawn', { channelId, slug, broadcastId, template }, { warnOnly: true })
}
