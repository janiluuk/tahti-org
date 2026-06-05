// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHmac } from 'node:crypto'

export type AcrcloudTrackMatch = {
  title: string
  artist?: string
  score: number
}

type AcrcloudArtist = { name?: string }
type AcrcloudMusic = { title?: string; artists?: AcrcloudArtist[]; score?: number }

/** Build ACRCloud Identification API v1 HMAC signature. */
export function buildAcrcloudSignature(opts: {
  accessKey: string
  accessSecret: string
  timestamp: number
  dataType?: 'audio' | 'fingerprint'
}): string {
  const dataType = opts.dataType ?? 'audio'
  const stringToSign = [
    'POST',
    '/v1/identify',
    opts.accessKey,
    dataType,
    '1',
    String(opts.timestamp),
  ].join('\n')

  return createHmac('sha1', opts.accessSecret).update(stringToSign).digest('base64')
}

/** Parse ACRCloud identify JSON (metadata.music). */
export function parseAcrcloudIdentifyResponse(body: unknown): AcrcloudTrackMatch | null {
  if (!body || typeof body !== 'object') return null
  const status = (body as { status?: { code?: number } }).status
  if (status?.code !== 0) return null

  const music = (body as { metadata?: { music?: AcrcloudMusic[] } }).metadata?.music
  if (!Array.isArray(music) || music.length === 0) return null

  let best: AcrcloudTrackMatch | null = null
  for (const track of music) {
    if (!track.title?.trim()) continue
    const score = typeof track.score === 'number' ? track.score : 0
    const artist = track.artists?.map((a) => a.name?.trim()).find(Boolean)
    const match: AcrcloudTrackMatch = {
      title: track.title.trim(),
      ...(artist ? { artist } : {}),
      score,
    }
    if (!best || match.score > best.score) best = match
  }

  return best
}

/** Identify an audio sample via ACRCloud (12s MP3/WAV recommended). */
export async function identifyAcrcloudAudioSample(
  sample: Buffer,
  opts: {
    host: string
    accessKey: string
    accessSecret: string
    fetchFn?: typeof fetch
  },
): Promise<AcrcloudTrackMatch | null> {
  const accessKey = opts.accessKey.trim()
  const accessSecret = opts.accessSecret.trim()
  if (!accessKey || !accessSecret || sample.length === 0) return null

  const host = opts.host.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildAcrcloudSignature({
    accessKey,
    accessSecret,
    timestamp,
    dataType: 'audio',
  })

  const form = new FormData()
  form.append('sample', new Blob([new Uint8Array(sample)]), 'sample.mp3')
  form.append('access_key', accessKey)
  form.append('sample_bytes', String(sample.length))
  form.append('timestamp', String(timestamp))
  form.append('signature', signature)
  form.append('data_type', 'audio')
  form.append('signature_version', '1')

  const fetchFn = opts.fetchFn ?? fetch
  let res: Response
  try {
    res = await fetchFn(`https://${host}/v1/identify`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return null
  }

  return parseAcrcloudIdentifyResponse(json)
}
