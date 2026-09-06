// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export function previewLogLine(line: string, max = 88): string {
  const trimmed = line.replace(/\s+/g, ' ').trim()
  if (!trimmed) return 'Empty line'
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trimEnd()}…`
}
