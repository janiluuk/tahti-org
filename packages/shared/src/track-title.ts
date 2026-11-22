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
