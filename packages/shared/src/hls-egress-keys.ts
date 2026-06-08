// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Per-channel slug UTC-day HLS bytes served by Caddy (INCRBY from access log). */
export function hlsEgressRedisKey(slug: string, utcDate: string): string {
  return `tahti:hls-egress:${slug}:${utcDate}`
}

/** Per-channel slug UTC-day set of anonymized listener-id hashes (SADD/SCARD from access log). */
export function hlsListenersRedisKey(slug: string, utcDate: string): string {
  return `tahti:hls-listeners:${slug}:${utcDate}`
}

export const HLS_CADDY_LOG_OFFSET_KEY = 'tahti:hls-caddy-log:offset'

/** Keep counters slightly longer than the 30-day dashboard window. */
export const HLS_EGRESS_REDIS_TTL_SEC = 45 * 86_400
