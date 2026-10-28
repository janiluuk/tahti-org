// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Pure, dependency-free timeline math for a Listening Party. The server never
// plays the release out itself: every client plays the tracks on its own and
// seeks to the offset this returns, so a late join lands where everyone else
// is. tahti-web mirrors this algorithm to tick the page between polls; keep
// the boundary rules here and there identical.

export type ListeningPartyState = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELED'

export interface ListeningPartyTimelineTrack {
  id: string
  position: number
  /** Null or negative counts as zero length. */
  durationSec: number | null
}

export interface ListeningPartyTimelineInput {
  startAt: Date | string
  tracks: readonly ListeningPartyTimelineTrack[]
  canceledAt?: Date | string | null
  now: Date | number
}

export interface ListeningPartyNowPlaying {
  trackId: string
  position: number
  /** Seconds into the track, fractional (millisecond precision). */
  offsetSec: number
}

export interface ListeningPartyTimeline {
  state: ListeningPartyState
  endAt: Date
  nowPlaying: ListeningPartyNowPlaying | null
}

function toMs(value: Date | string | number): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

function trackMs(track: ListeningPartyTimelineTrack): number {
  return Math.max(0, track.durationSec ?? 0) * 1000
}

/** Total running time of the tracks, in seconds. */
export function listeningPartyDurationSec(
  tracks: readonly Pick<ListeningPartyTimelineTrack, 'durationSec'>[],
): number {
  return tracks.reduce((sum, t) => sum + Math.max(0, t.durationSec ?? 0), 0)
}

/**
 * State and now-playing at `now`. Tracks play once, in `position` order, with
 * no gaps. Intervals are half-open: a track owns [start, start + duration),
 * so at an exact boundary the next track is playing at offset 0, and at
 * `endAt` itself the party has ENDED.
 */
export function computeListeningPartyTimeline(
  input: ListeningPartyTimelineInput,
): ListeningPartyTimeline {
  const startMs = toMs(input.startAt)
  const nowMs = toMs(input.now)
  const ordered = [...input.tracks].sort((a, b) => a.position - b.position)
  const endMs = startMs + ordered.reduce((sum, t) => sum + trackMs(t), 0)
  const endAt = new Date(endMs)

  if (input.canceledAt) return { state: 'CANCELED', endAt, nowPlaying: null }
  if (nowMs < startMs) return { state: 'SCHEDULED', endAt, nowPlaying: null }
  if (nowMs >= endMs) return { state: 'ENDED', endAt, nowPlaying: null }

  let trackStartMs = startMs
  for (const track of ordered) {
    const trackEndMs = trackStartMs + trackMs(track)
    if (nowMs < trackEndMs) {
      return {
        state: 'LIVE',
        endAt,
        nowPlaying: {
          trackId: track.id,
          position: track.position,
          offsetSec: (nowMs - trackStartMs) / 1000,
        },
      }
    }
    trackStartMs = trackEndMs
  }
  return { state: 'ENDED', endAt, nowPlaying: null }
}
