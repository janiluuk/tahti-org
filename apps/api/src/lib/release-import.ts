// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { ReleaseImportRowSchema, type ReleaseImportRow } from '@tahti/shared'

const HEADER_ALIASES: Record<string, keyof ReleaseImportRow | 'skip'> = {
  releasetitle: 'releaseTitle',
  title: 'releaseTitle',
  release_title: 'releaseTitle',
  type: 'type',
  releasedate: 'releaseDate',
  release_date: 'releaseDate',
  date: 'releaseDate',
  tracktitle: 'trackTitle',
  track: 'trackTitle',
  track_title: 'trackTitle',
  isrc: 'isrc',
  upc: 'upc',
  description: 'description',
  desc: 'description',
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '')
}

/** Parse M12 bulk-import CSV (one row per track; rows grouped by title + date). */
export function parseReleaseImportCsv(csv: string): {
  groups: ReleaseImportRow[][]
  errors: string[]
} {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  if (lines.length === 0) {
    return { groups: [], errors: ['CSV is empty'] }
  }

  const firstCells = splitCsvLine(lines[0]!)
  const headerKeys = firstCells.map(normalizeHeader)
  const hasHeader = headerKeys.some((h) => h in HEADER_ALIASES)
  const dataLines = hasHeader ? lines.slice(1) : lines

  const columnMap: Array<keyof ReleaseImportRow | null> = hasHeader
    ? headerKeys.map((h) => {
        const mapped = HEADER_ALIASES[h]
        return mapped === 'skip' || mapped === undefined ? null : mapped
      })
    : ['releaseTitle', 'type', 'releaseDate', 'trackTitle', 'isrc', 'upc', 'description']

  const rows: ReleaseImportRow[] = []
  const errors: string[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const cells = splitCsvLine(dataLines[i]!)
    const record: Record<string, string> = {}
    for (let c = 0; c < columnMap.length; c++) {
      const key = columnMap[c]
      if (!key) continue
      record[key] = cells[c] ?? ''
    }

    const parsed = ReleaseImportRowSchema.safeParse(record)
    if (!parsed.success) {
      errors.push(`Row ${i + (hasHeader ? 2 : 1)}: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
      continue
    }
    rows.push(parsed.data)
  }

  const groupMap = new Map<string, ReleaseImportRow[]>()
  for (const row of rows) {
    const key = `${row.releaseTitle}\0${row.releaseDate.toISOString().slice(0, 10)}`
    const list = groupMap.get(key) ?? []
    list.push(row)
    groupMap.set(key, list)
  }

  return { groups: [...groupMap.values()], errors }
}
