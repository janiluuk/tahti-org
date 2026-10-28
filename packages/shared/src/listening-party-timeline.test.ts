// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  computeListeningPartyTimeline,
  listeningPartyDurationSec,
} from './listening-party-timeline.js'
import {
  CreateListeningPartyBodySchema,
  LISTENING_PARTY_STATES,
  UpdateListeningPartyBodySchema,
} from './dto/listening-party.js'

const START = '2026-11-01T18:00:00.000Z'
const startMs = Date.parse(START)
const at = (sec: number) => new Date(startMs + sec * 1000)

// Deliberately out of position order: the timeline must sort.
const TRACKS = [
  { id: 't2', position: 2, durationSec: 200 },
  { id: 't1', position: 1, durationSec: 100 },
  { id: 't3', position: 3, durationSec: 50 },
]

function timeline(nowSec: number, extra: { canceledAt?: string | null } = {}) {
  return computeListeningPartyTimeline({
    startAt: START,
    tracks: TRACKS,
    now: at(nowSec),
    ...extra,
  })
}

describe('computeListeningPartyTimeline', () => {
  it('ends after the summed track durations', () => {
    expect(timeline(0).endAt.toISOString()).toBe('2026-11-01T18:05:50.000Z')
  })

  it('is SCHEDULED before startAt', () => {
    expect(timeline(-3600)).toMatchObject({ state: 'SCHEDULED', nowPlaying: null })
    expect(timeline(-0.001)).toMatchObject({ state: 'SCHEDULED', nowPlaying: null })
  })

  it('is LIVE on the first track at exactly startAt', () => {
    expect(timeline(0)).toMatchObject({
      state: 'LIVE',
      nowPlaying: { trackId: 't1', position: 1, offsetSec: 0 },
    })
  })

  it('reports the offset into the current track mid-track', () => {
    expect(timeline(42.5).nowPlaying).toEqual({ trackId: 't1', position: 1, offsetSec: 42.5 })
    expect(timeline(250).nowPlaying).toEqual({ trackId: 't2', position: 2, offsetSec: 150 })
  })

  it('moves to the next track at offset 0 on an exact boundary', () => {
    expect(timeline(99.999).nowPlaying?.trackId).toBe('t1')
    expect(timeline(100).nowPlaying).toEqual({ trackId: 't2', position: 2, offsetSec: 0 })
    expect(timeline(300).nowPlaying).toEqual({ trackId: 't3', position: 3, offsetSec: 0 })
  })

  it('is still LIVE just before the end and ENDED at endAt', () => {
    expect(timeline(349.999)).toMatchObject({ state: 'LIVE', nowPlaying: { trackId: 't3' } })
    expect(timeline(350)).toMatchObject({ state: 'ENDED', nowPlaying: null })
    expect(timeline(86_400)).toMatchObject({ state: 'ENDED', nowPlaying: null })
  })

  it('is CANCELED whatever the clock says', () => {
    const canceledAt = '2026-10-30T12:00:00.000Z'
    for (const sec of [-60, 0, 150, 400]) {
      expect(timeline(sec, { canceledAt })).toMatchObject({ state: 'CANCELED', nowPlaying: null })
    }
    expect(timeline(150, { canceledAt: null }).state).toBe('LIVE')
  })

  it('goes straight from SCHEDULED to ENDED with zero tracks', () => {
    const empty = (sec: number) =>
      computeListeningPartyTimeline({ startAt: START, tracks: [], now: at(sec) })
    expect(empty(-1)).toMatchObject({ state: 'SCHEDULED', nowPlaying: null })
    expect(empty(0)).toMatchObject({ state: 'ENDED', nowPlaying: null })
    expect(empty(0).endAt.toISOString()).toBe(START)
  })

  it('skips zero-length and unknown-length tracks', () => {
    const tracks = [
      { id: 'a', position: 1, durationSec: 0 },
      { id: 'b', position: 2, durationSec: null },
      { id: 'c', position: 3, durationSec: 10 },
    ]
    const result = computeListeningPartyTimeline({ startAt: START, tracks, now: at(0) })
    expect(result.nowPlaying).toEqual({ trackId: 'c', position: 3, offsetSec: 0 })
    expect(result.endAt.toISOString()).toBe('2026-11-01T18:00:10.000Z')
  })

  it('accepts Date inputs and a numeric clock', () => {
    const result = computeListeningPartyTimeline({
      startAt: new Date(START),
      tracks: TRACKS,
      now: startMs + 120_000,
    })
    expect(result.nowPlaying).toEqual({ trackId: 't2', position: 2, offsetSec: 20 })
  })
})

describe('listeningPartyDurationSec', () => {
  it('sums durations, treating missing ones as zero', () => {
    expect(listeningPartyDurationSec(TRACKS)).toBe(350)
    expect(listeningPartyDurationSec([{ durationSec: null }, { durationSec: 5 }])).toBe(5)
    expect(listeningPartyDurationSec([])).toBe(0)
  })
})

describe('listening party bodies', () => {
  it('lists the four derived states', () => {
    expect(LISTENING_PARTY_STATES).toEqual(['SCHEDULED', 'LIVE', 'ENDED', 'CANCELED'])
  })

  it('stores a blank host note as null on create', () => {
    const parsed = CreateListeningPartyBodySchema.parse({
      releaseId: 'rel1',
      startAt: START,
      hostNote: '   ',
    })
    expect(parsed.hostNote).toBeNull()
  })

  it('rejects a host note over 2000 characters', () => {
    const result = CreateListeningPartyBodySchema.safeParse({
      releaseId: 'rel1',
      startAt: START,
      hostNote: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a startAt that is not an ISO datetime', () => {
    expect(
      CreateListeningPartyBodySchema.safeParse({ releaseId: 'rel1', startAt: 'tomorrow' }).success,
    ).toBe(false)
  })

  it('leaves an omitted host note alone on update and clears a blank one', () => {
    expect(UpdateListeningPartyBodySchema.parse({}).hostNote).toBeUndefined()
    expect(UpdateListeningPartyBodySchema.parse({ hostNote: '' }).hostNote).toBeNull()
    expect(UpdateListeningPartyBodySchema.parse({ hostNote: null }).hostNote).toBeNull()
    expect(UpdateListeningPartyBodySchema.parse({ hostNote: ' Hi ' }).hostNote).toBe('Hi')
  })
})
