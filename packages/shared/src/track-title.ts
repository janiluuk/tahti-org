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
/** Between names in a credit like "Yaniho x Chisu & Orkidea". "&" and "x"
 * need spaces around them so "G&D" or "Mix" stay one name. */
const CREDIT_SEPARATOR = '(?:\\s*,\\s*|\\s+(?:x|&|feat\\.?|ft\\.?|vs\\.?)\\s+)'
/** A co-credited name: any text except a " - " style separator, so a
 * credit never runs on into the album part. "Jay-Z" still fits. */
const OTHER_NAME = '(?:(?![-–—]\\s|\\s[-–—]).)+?'
const RECORD_FORMAT = /\s+(?:LP|EP)$/i

function sortedNames(artistNames: Array<string | null | undefined>): string[] {
  return artistNames
    .map((name) => name?.trim())
    .filter((name): name is string => !!name)
    .sort((a, b) => b.length - a.length)
}

/** A credit naming one of the artists, alone or among others. */
function creditPattern(artistNames: Array<string | null | undefined>): string | null {
  const names = sortedNames(artistNames).map(loosePattern)
  if (names.length === 0) return null
  return `(?:${OTHER_NAME}${CREDIT_SEPARATOR})?(?:${names.join('|')})(?:${CREDIT_SEPARATOR}${OTHER_NAME})?`
}

/** The album name with or without a trailing "LP" or "EP". */
function albumPattern(albumName: string): string {
  const base = albumName.trim().replace(RECORD_FORMAT, '')
  return base ? `${loosePattern(base)}(?:\\s+(?:LP|EP))?` : loosePattern(albumName)
}

/**
 * The album name as compared between titles and collections: case, spacing,
 * dash style and a trailing "LP" or "EP" do not matter, so "Sisufuzz EP" and
 * "sisufuzz  LP" are the same album.
 */
export function albumKey(albumName: string): string {
  const name = albumName.trim().replace(/[-–—]/g, '-').replace(/\s+/g, ' ').toLowerCase()
  return name.replace(/ (?:lp|ep)$/, '') || name
}

/** The names in a credit other than the artist's own, or null when the
 * credit does not name the artist. */
function otherArtists(
  credit: string,
  artistNames: Array<string | null | undefined>,
): string[] | null {
  for (const name of sortedNames(artistNames)) {
    const match = credit.match(
      new RegExp(
        `^(?:(.+?)${CREDIT_SEPARATOR})?${loosePattern(name)}(?:${CREDIT_SEPARATOR}(.+))?$`,
        'i',
      ),
    )
    if (!match) continue
    return [match[1], match[2]]
      .flatMap((part) => (part ? part.split(new RegExp(CREDIT_SEPARATOR, 'i')) : []))
      .map((other) => other.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  }
  return null
}

function listNames(names: string[]): string {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]!}`
    : (names[0] ?? '')
}

function trackParts(
  groups: Record<string, string | undefined>,
  artistNames: Array<string | null | undefined>,
): { title: string; trackNumber: number } | null {
  const trackNumber = Number(groups.number)
  let title = (groups.rest ?? '').replace(/\s+/g, ' ').trim()
  if (trackNumber < 1 || !title) return null
  if (groups.credit) {
    const others = otherArtists(groups.credit, artistNames)
    if (!others) return null
    const lower = title.toLowerCase()
    const unnamed = others.filter((other) => !lower.includes(other.toLowerCase()))
    if (unnamed.length > 0) title = `${title} (with ${listNames(unnamed)})`
  }
  return { title, trackNumber }
}

const TRACK = `${SEPARATOR}(?<number>\\d{1,3})${NUMBER_END}(?<rest>\\S.*)$`

/**
 * Splits an imported title of the form "Artist - Album - 02 - Title" (artist
 * part optional) into the track title and its number on the album. Returns
 * null unless the title starts with the album name (optionally after a
 * credit naming one of `artistNames`) followed by a 1-3 digit track number,
 * so a title that only mentions the album is never cut. A trailing "LP" or
 * "EP" on either album name is optional. Other names in the credit ("Yaniho
 * x Chisu & Orkidea") end up as "Title (with Chisu & Orkidea)" unless the
 * title already names them.
 */
export function parseAlbumTrackTitle(
  title: string,
  options: { artistNames: Array<string | null | undefined>; albumName: string },
): { title: string; trackNumber: number } | null {
  if (!options.albumName.trim()) return null
  const credit = creditPattern(options.artistNames)
  const match = title
    .trim()
    .match(
      new RegExp(
        `^${credit ? `(?:(?<credit>${credit})${SEPARATOR})?` : ''}${albumPattern(options.albumName)}${TRACK}`,
        'i',
      ),
    )
  return match?.groups ? trackParts(match.groups, options.artistNames) : null
}

/**
 * Reads "Artist - Album - 02 - Title" without knowing the album: the credit
 * naming one of `artistNames` is required here, and the album is everything
 * up to the first track number. For finding titles in that shape; the title
 * is cleaned the same way as by `parseAlbumTrackTitle`.
 */
export function splitAlbumTrackTitle(
  title: string,
  options: { artistNames: Array<string | null | undefined> },
): { albumName: string; title: string; trackNumber: number } | null {
  const credit = creditPattern(options.artistNames)
  if (!credit) return null
  const match = title
    .trim()
    .match(new RegExp(`^(?<credit>${credit})${SEPARATOR}(?<album>\\S.*?)${TRACK}`, 'i'))
  if (!match?.groups) return null
  const parts = trackParts(match.groups, options.artistNames)
  return parts ? { albumName: match.groups.album!.replace(/\s+/g, ' ').trim(), ...parts } : null
}
