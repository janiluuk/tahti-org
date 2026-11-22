// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { trackTitleFromFilename } from '@tahti/shared'

/** Title for an upload whose client sent none: the track title cleaned out
 * of the file name, with the uploader's own name dropped from an
 * "Artist - Title" name. */
export function titleFromFilename(
  filename: string,
  artistNames: Array<string | null | undefined> = [],
): string {
  return (trackTitleFromFilename(filename, { artistNames }) || 'Untitled upload').slice(0, 200)
}
