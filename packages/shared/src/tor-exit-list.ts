// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** M18: Tor Project bulk exit list — synced daily by worker, bundled fallback for cold start. */

export const TOR_EXIT_LIST_URL = 'https://check.torproject.org/torbulkexitlist?ip=0.0.0.0'

/** Redis JSON array of /32 CIDR strings (worker `tor-exit-list-sync`). */
export const TOR_EXIT_REDIS_KEY = 'tahti:download:tor_exit_cidrs'

const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

/** Parse torbulkexitlist body into /32 CIDRs for `evaluateDownloadCountPolicy`. */
export function parseTorBulkExitList(body: string): string[] {
  const out: string[] = []
  for (const line of body.split('\n')) {
    const ip = line.trim()
    if (!ip || ip.startsWith('#')) continue
    if (!IPV4.test(ip)) continue
    const parts = ip.split('.').map(Number)
    if (parts.some((o) => o < 0 || o > 255)) continue
    out.push(`${ip}/32`)
  }
  return out
}
