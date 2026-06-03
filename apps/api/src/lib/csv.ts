// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function csvRow(cols: (string | number | null | undefined)[]): string {
  return cols
    .map((c) => {
      if (c == null) return ''
      return csvEscape(String(c))
    })
    .join(',')
}
