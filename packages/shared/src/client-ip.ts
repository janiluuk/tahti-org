// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Leftmost public client IP from proxy headers (PLAT-062). */
export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fallback = '',
): string {
  const xff = headers['x-forwarded-for']
  const raw = Array.isArray(xff) ? xff[0] : xff
  if (typeof raw === 'string' && raw.trim()) {
    const first = raw.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = headers['x-real-ip']
  const rip = Array.isArray(realIp) ? realIp[0] : realIp
  if (typeof rip === 'string' && rip.trim()) return rip.trim()

  return fallback
}
