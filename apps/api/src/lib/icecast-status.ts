// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const FETCH_TIMEOUT_MS = 2000

interface IcecastSource {
  listenurl?: string
  server_type?: string
  bitrate?: number | string
  audio_info?: string
  listeners?: number
}

export interface MountSignalStatus {
  connected: boolean
  codec: string | null
  bitrateKbps: number | null
  listeners: number | null
}

const CODEC_LABELS: Record<string, string> = {
  'audio/mpeg': 'MP3',
  'application/ogg': 'Ogg Vorbis',
  'audio/ogg': 'Ogg Vorbis',
  'audio/flac': 'FLAC',
  'audio/x-flac': 'FLAC',
  'audio/aac': 'AAC',
  'audio/aacp': 'AAC+',
}

function codecLabel(serverType: string | undefined): string | null {
  if (!serverType) return null
  return CODEC_LABELS[serverType.toLowerCase()] ?? serverType
}

function bitrateOf(source: IcecastSource): number | null {
  if (typeof source.bitrate === 'number') return source.bitrate
  if (typeof source.bitrate === 'string' && source.bitrate.trim()) {
    const n = Number(source.bitrate)
    if (!Number.isNaN(n)) return n
  }
  const match = source.audio_info?.match(/bitrate=(\d+)/)
  return match ? Number(match[1]) : null
}

/** Parses Icecast's /status-json.xsl body, matching the source whose listenurl ends with `mount`. */
export function parseIcecastMountStatus(body: unknown, mount: string): MountSignalStatus {
  const notConnected: MountSignalStatus = {
    connected: false,
    codec: null,
    bitrateKbps: null,
    listeners: null,
  }

  const icestats = (body as { icestats?: { source?: IcecastSource | IcecastSource[] } })?.icestats
  if (!icestats?.source) return notConnected

  const sources = Array.isArray(icestats.source) ? icestats.source : [icestats.source]
  const match = sources.find((s) => s.listenurl?.endsWith(mount))
  if (!match) return notConnected

  return {
    connected: true,
    codec: codecLabel(match.server_type),
    bitrateKbps: bitrateOf(match),
    listeners: typeof match.listeners === 'number' ? match.listeners : null,
  }
}

/** Queries Icecast's own status JSON for a single mount's live signal (codec/bitrate/listeners). */
export async function fetchMountSignalStatus(
  icecastBaseUrl: string,
  mount: string,
): Promise<MountSignalStatus> {
  const url = `${icecastBaseUrl.replace(/\/$/, '')}/status-json.xsl`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return { connected: false, codec: null, bitrateKbps: null, listeners: null }
    const body = await res.json()
    return parseIcecastMountStatus(body, mount)
  } catch {
    return { connected: false, codec: null, bitrateKbps: null, listeners: null }
  }
}
