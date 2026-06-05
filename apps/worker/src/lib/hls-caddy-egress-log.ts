// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { open, stat } from 'node:fs/promises'

export interface HlsCaddyEgressEvent {
  slug: string
  bytes: number
  utcDate: string
}

/** Parse one Caddy JSON access log line for stream.tahti.live HLS paths /{slug}/… */
export function parseHlsCaddyLogLine(line: string, now = new Date()): HlsCaddyEgressEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const row = JSON.parse(trimmed) as {
      request?: { uri?: string }
      status?: number
      size?: number
      ts?: number
    }
    if (row.status !== 200 || typeof row.size !== 'number' || row.size <= 0) return null
    const uri = (row.request?.uri ?? '').split('?')[0] ?? ''
    const match = uri.match(/^\/([^/]+)\//)
    if (!match?.[1]) return null
    const slug = match[1]
    if (slug === 'hls-live' || slug.startsWith('.')) return null
    const ts = typeof row.ts === 'number' ? new Date(row.ts * 1000) : now
    return { slug, bytes: row.size, utcDate: ts.toISOString().slice(0, 10) }
  } catch {
    return null
  }
}

export async function readHlsCaddyLogFromOffset(
  path: string,
  offset: number,
): Promise<{ events: HlsCaddyEgressEvent[]; nextOffset: number }> {
  let st
  try {
    st = await stat(path)
  } catch {
    return { events: [], nextOffset: 0 }
  }

  if (st.size < offset) offset = 0
  if (st.size <= offset) return { events: [], nextOffset: offset }

  const fh = await open(path, 'r')
  try {
    const toRead = st.size - offset
    const buf = Buffer.alloc(toRead)
    await fh.read(buf, 0, toRead, offset)
    const text = buf.toString('utf8')
    const lines = text.split('\n')

    let completeLines = lines
    let nextOffset = st.size
    if (!text.endsWith('\n') && lines.length > 0) {
      completeLines = lines.slice(0, -1)
      const consumed = completeLines.join('\n')
      nextOffset = offset + (consumed.length > 0 ? Buffer.byteLength(`${consumed}\n`, 'utf8') : 0)
    }

    const events: HlsCaddyEgressEvent[] = []
    for (const line of completeLines) {
      const ev = parseHlsCaddyLogLine(line)
      if (ev) events.push(ev)
    }
    return { events, nextOffset }
  } finally {
    await fh.close()
  }
}
