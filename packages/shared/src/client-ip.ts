// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Client IP from proxy headers (PLAT-062).
 *
 * SEC-014: takes the right-most (nearest-hop) entry, not the left-most.
 * Exactly one reverse proxy fronts the API in every real deployment, and
 * that proxy appends its own observation of the caller to X-Forwarded-For
 * rather than replacing it — so the right-most entry is the one hop that
 * can't be forged by the client, while the left-most is whatever the client
 * put there themselves (e.g. to fake a different IP for rate limits or
 * per-IP bans). For the normal single-entry case both ends of the list are
 * the same value. */
export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fallback = '',
): string {
  const xff = headers['x-forwarded-for']
  const raw = Array.isArray(xff) ? xff[xff.length - 1] : xff
  if (typeof raw === 'string' && raw.trim()) {
    const parts = raw.split(',')
    const last = parts[parts.length - 1]?.trim()
    if (last) return last
  }

  const realIp = headers['x-real-ip']
  const rip = Array.isArray(realIp) ? realIp[0] : realIp
  if (typeof rip === 'string' && rip.trim()) return rip.trim()

  return fallback
}
