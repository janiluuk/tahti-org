// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { createClient } from 'redis'
import { TOR_EXIT_LIST_URL, TOR_EXIT_REDIS_KEY, parseTorBulkExitList } from '@tahti/shared'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

export async function processTorExitListSyncJob(_job: Job): Promise<void> {
  const res = await fetch(TOR_EXIT_LIST_URL, {
    headers: { 'User-Agent': 'Tahti-worker-tor-exit-sync/1.0' },
  })
  if (!res.ok) {
    throw new Error(`Tor exit list fetch failed: ${res.status}`)
  }
  const cidrs = parseTorBulkExitList(await res.text())
  const client = createClient({ url: REDIS_URL })
  await client.connect()
  try {
    await client.set(TOR_EXIT_REDIS_KEY, JSON.stringify(cidrs), { EX: 48 * 3600 })
  } finally {
    await client.disconnect()
  }
  console.log('[worker] tor-exit-list-sync:', { exits: cidrs.length })
}
