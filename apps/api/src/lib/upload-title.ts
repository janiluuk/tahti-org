// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Title for an upload whose client sent none: the file name without its
 * extension, underscores read as spaces. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
  const title = base.replace(/_+/g, ' ').trim()
  return (title || 'Untitled upload').slice(0, 200)
}
