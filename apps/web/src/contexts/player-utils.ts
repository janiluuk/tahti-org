// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Pure player helpers extracted from player-context.tsx so they can be
// unit-tested without mounting the provider (no React, no audio element).

export const VOLUME_STORAGE_KEY = 'tahti-player-volume'
export const MUTED_STORAGE_KEY = 'tahti-player-muted'

/** Seconds between listen-heartbeat "still listening" pings while actively
 * playing — the server tracks sessions (start/last-seen/end), not seconds
 * self-reported by the client, so this only needs to be frequent enough
 * that the listen-session-close cron doesn't close a session that's
 * actually still going. Deliberately relaxed (not per-second, not even
 * per-minute) — session start/end boundaries land within a few minutes of
 * reality, which is plenty for minutes-listened analytics, in exchange for
 * a small fraction of the request volume. See STALE_AFTER_MS in
 * packages/db/src/listen-sessions.ts, which must stay comfortably above
 * this. */
export const HEARTBEAT_INTERVAL_SEC = 180

/** The dual-bitrate HLS output (infra/liquidsoap-channel.liq.template) only ever
 * offers two renditions — 192kbps MP3 or lossless FLAC — so a bitrate well above
 * the MP3 rendition reliably means the FLAC one is playing. */
export function qualityLabelForBitrate(bitrateBps: number): string {
  return bitrateBps >= 400_000 ? 'FLAC' : `${Math.round(bitrateBps / 1000)} kbps`
}

/** liveHlsManifestPath() always points hls.js straight at a single-rendition
 * MEDIA playlist (stream-mp3-192.m3u8) — there's no master playlist with
 * per-variant #EXT-X-STREAM-INF/BANDWIDTH tags for hls.js to read a real
 * bitrate from, so hls.levels[].bitrate is hls.js's own unmeasured guess and
 * reads as 0 right after a level switch. The manifest is always the 192kbps
 * MP3 rendition, so that's the honest default the instant playback starts;
 * a later LEVEL_SWITCHED with a genuinely-measured positive bitrate (e.g. if
 * a real multi-bitrate master playlist is ever introduced) can still refine it. */
export const DEFAULT_LIVE_STREAM_QUALITY = '192 kbps'

/** Classifies which surface a heartbeat tick came from, best-effort from
 * the current route — not meant to be exhaustive, `OTHER` is a fine
 * fallback for routes that don't map cleanly onto the shared
 * ListenSource enum (see @tahti/shared's dto/listen.ts). */
export function classifyListenSource(pathname: string | null): string {
  if (!pathname) return 'OTHER'
  if (pathname.startsWith('/embed/')) return 'EMBED'
  if (pathname === '/radio' || pathname.startsWith('/radio/')) return 'TAHTI_RADIO'
  if (/\/c\/[^/]+/.test(pathname)) return 'CHANNEL_PAGE'
  if (pathname.startsWith('/u/')) return 'ARTIST_PROFILE'
  if (pathname.startsWith('/listen') || pathname.startsWith('/feed')) return 'DISCOVER'
  if (pathname.startsWith('/dashboard/')) return 'LIBRARY'
  return 'OTHER'
}

export function readStoredVolume(): number {
  if (typeof window === 'undefined') return 1
  const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY)
  const parsed = raw != null ? Number(raw) : NaN
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1
}

export function readStoredMuted(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(MUTED_STORAGE_KEY) === '1'
}
