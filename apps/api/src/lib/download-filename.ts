// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** A safe, human-readable filename for a Content-Disposition header — strips
 * anything that would break the header value or look wrong in a save dialog. */
export function downloadFilename(title: string, extension: string): string {
  const safeTitle =
    title
      .replace(/["\\]/g, '')
      .replace(/[\r\n]/g, ' ')
      .trim()
      .slice(0, 120) || 'track'
  return `${safeTitle}.${extension}`
}
