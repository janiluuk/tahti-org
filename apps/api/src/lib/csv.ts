// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyReply } from 'fastify'

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

/** PLAT-024: consistent CSV download responses for admin/board exports. */
export function sendCsv(
  reply: FastifyReply,
  filename: string,
  header: (string | number)[],
  rows: (string | number | null | undefined)[][],
) {
  const body = [csvRow(header), ...rows.map((r) => csvRow(r))].join('\n')
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(body)
}
