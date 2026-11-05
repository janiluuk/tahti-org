// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type CamelotKey = { number: number; letter: 'A' | 'B' }

const MAJOR: Record<string, number> = {
  B: 1,
  'F#': 2,
  GB: 2,
  DB: 3,
  'C#': 3,
  AB: 4,
  'G#': 4,
  EB: 5,
  'D#': 5,
  BB: 6,
  'A#': 6,
  F: 7,
  C: 8,
  G: 9,
  D: 10,
  A: 11,
  E: 12,
}
const MINOR: Record<string, number> = {
  AB: 1,
  'G#': 1,
  EB: 2,
  'D#': 2,
  BB: 3,
  'A#': 3,
  F: 4,
  C: 5,
  G: 6,
  D: 7,
  A: 8,
  E: 9,
  B: 10,
  'F#': 11,
  GB: 11,
  DB: 12,
  'C#': 12,
}

/** Reads a key as stored on a sound ("Am", "A minor", "F#", "Gb major",
 * "8A", "8a") into the Camelot wheel; null when it isn't a key. */
export function toCamelot(raw: string | null | undefined): CamelotKey | null {
  if (!raw) return null
  const key = raw.trim().replace(/♯/g, '#').replace(/♭/g, 'b')
  const wheel = /^(1[0-2]|[1-9])\s*([ABab])$/.exec(key)
  if (wheel) {
    return { number: Number(wheel[1]), letter: wheel[2]!.toUpperCase() as 'A' | 'B' }
  }
  const named = /^([A-Ga-g])([#b]?)\s*(m|min|minor|maj|major)?$/i.exec(key)
  if (!named) return null
  const note = `${named[1]!.toUpperCase()}${named[2] === 'b' ? 'B' : named[2]}`
  const mode = (named[3] ?? '').toLowerCase()
  const minor = mode === 'm' || mode === 'min' || mode === 'minor'
  const number = (minor ? MINOR : MAJOR)[note]
  return number ? { number, letter: minor ? 'A' : 'B' } : null
}

export function camelotLabel(key: CamelotKey): string {
  return `${key.number}${key.letter}`
}

/** Steps between two keys for mixing: 0 same key, 1 a neighbour on the wheel
 * or the relative major/minor, higher is a clash. */
export function camelotDistance(a: CamelotKey, b: CamelotKey): number {
  const around = Math.abs(a.number - b.number)
  const steps = Math.min(around, 12 - around)
  return steps + (a.letter === b.letter ? 0 : 1)
}

export type MixTrack = { id: string; bpm: number | null; key: string | null }

/** Cost of playing `to` after `from`: key clashes weigh most, then tempo. */
function transitionCost(
  from: MixTrack & { camelot: CamelotKey },
  to: MixTrack & { camelot: CamelotKey },
) {
  const bpmGap = from.bpm != null && to.bpm != null ? Math.abs(from.bpm - to.bpm) : 8
  return camelotDistance(from.camelot, to.camelot) * 10 + bpmGap
}

/**
 * Orders tracks for a DJ-style mix: start from the slowest track with a key,
 * then repeatedly take the cheapest next transition (harmonic first, tempo
 * second). Tracks without a readable key can't be placed and are returned
 * separately, in their original order.
 */
export function suggestMixOrder<T extends MixTrack>(
  tracks: T[],
): { ordered: Array<T & { camelot: string }>; unplaced: T[] } {
  const placeable = tracks
    .map((t) => ({ track: t, camelot: toCamelot(t.key) }))
    .filter((t): t is { track: T; camelot: CamelotKey } => t.camelot !== null)
  const unplaced = tracks.filter((t) => toCamelot(t.key) === null)
  if (placeable.length === 0) return { ordered: [], unplaced }

  const remaining = placeable.map(({ track, camelot }) => ({ ...track, camelot }))
  remaining.sort((a, b) => (a.bpm ?? Infinity) - (b.bpm ?? Infinity))
  const ordered = [remaining.shift()!]
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1]!
    let best = 0
    for (let i = 1; i < remaining.length; i += 1) {
      if (transitionCost(last, remaining[i]!) < transitionCost(last, remaining[best]!)) best = i
    }
    ordered.push(remaining.splice(best, 1)[0]!)
  }
  return {
    ordered: ordered.map((t) => ({ ...t, camelot: camelotLabel(t.camelot) })),
    unplaced,
  }
}
