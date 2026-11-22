// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** An extension has a letter in it, so a date like "Live 10.7.26" keeps its
 * last part. */
const EXTENSION = /\.[a-z0-9]*[a-z][a-z0-9]*$/i
/** "01 ", "01. ", "1. ", "1 - ", "12) ": a leading zero or a separator marks
 * a track number, so "99 Luftballons" keeps its number. */
const TRACK_NUMBER = /^(?:0\d{1,2}(?:\s*[-.)_]\s*|\s+)|[1-9]\d{0,2}\s*[-.)]\s+)(?=\S)/
/** "Song (1)" from a browser saving the same file twice. */
const DUPLICATE_SUFFIX = /\s+\(\d{1,2}\)$/
/** "[www.example.com]" or "(example.net)" tacked on by download sites. */
const SITE_TAG =
  /\s*[[(](?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,6}\/?[\])]\s*/gi

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * A track title from an audio file's name: no directory, extension, track
 * number, "Artist - " prefix (for the names given), download-site tag or
 * duplicate-copy suffix. Falls back to the plain file name when cleaning
 * would leave nothing.
 */
export function trackTitleFromFilename(
  filename: string,
  options: { artistNames?: Array<string | null | undefined> } = {},
): string {
  const base = filename
    .replace(/^.*[\\/]/, '')
    .replace(EXTENSION, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let title = base.replace(SITE_TAG, ' ').replace(/\s+/g, ' ').trim()
  title = title.replace(TRACK_NUMBER, '')
  for (const name of options.artistNames ?? []) {
    const artist = name?.trim()
    if (!artist) continue
    const prefix = new RegExp(`^${escapeRegExp(artist)}\\s+[-–—]\\s+(?=\\S)`, 'i')
    if (prefix.test(title)) {
      title = title.replace(prefix, '').replace(TRACK_NUMBER, '')
      break
    }
  }
  title = title.replace(DUPLICATE_SUFFIX, '').trim()
  return title || base
}

/** A name as a pattern: any run of spaces matches any run of spaces and any
 * dash matches any dash, since imports mix "-", "–" and "—". */
function loosePattern(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => escapeRegExp(word).replace(/[-–—]/g, '[-–—]'))
    .join('\\s+')
}

const SEPARATOR = '\\s*[-–—]\\s*'
/** After the number a dash needs a space behind it, so "Album - 2-Step"
 * is not read as track 2 called "Step". */
const NUMBER_END = '(?:\\.?\\s*[-–—]\\s+|\\.\\s+)'

function artistPattern(artistNames: Array<string | null | undefined>): string | null {
  const artists = artistNames
    .map((name) => name?.trim())
    .filter((name): name is string => !!name)
    .sort((a, b) => b.length - a.length)
    .map(loosePattern)
  return artists.length > 0 ? `(?:${artists.join('|')})${SEPARATOR}` : null
}

function matchTrack(title: string, pattern: string): RegExpMatchArray | null {
  return title.trim().match(new RegExp(`^${pattern}(\\d{1,3})${NUMBER_END}(\\S.*)$`, 'i'))
}

function trackParts(
  numberText: string,
  rest: string,
): { title: string; trackNumber: number } | null {
  const trackNumber = Number(numberText)
  const title = rest.replace(/\s+/g, ' ').trim()
  return trackNumber >= 1 && title ? { title, trackNumber } : null
}

/**
 * Splits an imported title of the form "Artist - Album - 02 - Title" (artist
 * part optional) into the track title and its number on the album. Returns
 * null unless the title starts with the album name (optionally after one of
 * `artistNames`) followed by a 1-3 digit track number, so a title that only
 * mentions the album is never cut.
 */
export function parseAlbumTrackTitle(
  title: string,
  options: { artistNames: Array<string | null | undefined>; albumName: string },
): { title: string; trackNumber: number } | null {
  if (!options.albumName.trim()) return null
  const artist = artistPattern(options.artistNames)
  const match = matchTrack(
    title,
    `${artist ? `(?:${artist})?` : ''}${loosePattern(options.albumName)}${SEPARATOR}`,
  )
  return match ? trackParts(match[1]!, match[2]!) : null
}

/**
 * Reads "Artist - Album - 02 - Title" without knowing the album: the artist
 * part is required here, and the album is everything up to the first track
 * number. For finding titles in that shape, not for renaming them.
 */
export function splitAlbumTrackTitle(
  title: string,
  options: { artistNames: Array<string | null | undefined> },
): { albumName: string; title: string; trackNumber: number } | null {
  const artist = artistPattern(options.artistNames)
  if (!artist) return null
  const match = matchTrack(title, `${artist}(\\S.*?)${SEPARATOR}`)
  if (!match) return null
  const parts = trackParts(match[2]!, match[3]!)
  return parts ? { albumName: match[1]!.replace(/\s+/g, ' ').trim(), ...parts } : null
}
