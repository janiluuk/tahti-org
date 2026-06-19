// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Shared helpers for release upload / catalog Playwright e2e scripts. */

export { apiLogin } from './api-session.mjs'

/** Build a small mono 16-bit PCM WAV buffer (silence). */
export function makeSilentWav(durationSec = 1, sampleRate = 8000) {
  const numSamples = sampleRate * durationSec
  const dataSize = numSamples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}

export const CATALOG_COLOR_SCHEMES = {
  ALBUM: {
    bg: '#0a1628',
    accent: '#00d4aa',
    text: '#e8f4f0',
    muted: '#4a6670',
    highlight: '#66e3c4',
  },
  EP: {
    bg: '#1a0a28',
    accent: '#a855f7',
    text: '#f3e8ff',
    muted: '#6b5080',
    highlight: '#c084fc',
  },
  SINGLE: {
    bg: '#1c1408',
    accent: '#f59e0b',
    text: '#fef3c7',
    muted: '#78716c',
    highlight: '#fbbf24',
  },
}

export async function createRelease(api, { title, type, releaseDate, tracks }) {
  const res = await api.post(`${api._apiUrl}/api/me/releases`, {
    data: {
      title,
      type,
      releaseDate,
      tracks: tracks.map((title) => ({ title })),
    },
  })
  if (!res.ok()) throw new Error(`create release "${title}": ${res.status()}`)
  return res.json()
}

export async function patchReleaseVisual(api, releaseId, { visualPreset, colorScheme }) {
  const res = await api.patch(`${api._apiUrl}/api/me/releases/${releaseId}/visual`, {
    data: { visualPreset, colorScheme },
  })
  if (!res.ok()) throw new Error(`patch visual ${releaseId}: ${res.status()}`)
  return res.json()
}

export async function publishRelease(api, releaseId) {
  const res = await api.patch(`${api._apiUrl}/api/me/releases/${releaseId}`, {
    data: { state: 'PUBLISHED' },
  })
  if (!res.ok()) throw new Error(`publish ${releaseId}: ${res.status()}`)
  return res.json()
}

/** Create release → add track → presign → PUT → finalize (best-effort when MinIO reachable). */
export async function uploadTrack(api, releaseId, trackTitle, wavBytes, apiUrl) {
  const trackRes = await api.post(`${apiUrl}/api/me/releases/${releaseId}/tracks`, {
    data: { title: trackTitle },
  })
  if (!trackRes.ok()) return { ok: false, step: 'add-track', status: trackRes.status() }
  const track = await trackRes.json()

  const upRes = await api.post(`${apiUrl}/api/me/releases/${releaseId}/tracks/${track.id}/upload`, {
    data: { filename: `${trackTitle.toLowerCase().replace(/\s+/g, '-')}.wav`, contentType: 'audio/wav' },
  })
  if (!upRes.ok()) return { ok: false, step: 'presign', status: upRes.status() }
  const { uploadUrl } = await upRes.json()
  if (!uploadUrl) return { ok: false, step: 'presign-url' }

  try {
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/wav' },
      body: wavBytes,
    })
    if (!putRes.ok) return { ok: false, step: 'put', minio: true }
  } catch {
    return { ok: false, step: 'put', minio: false }
  }

  const finRes = await api.post(`${apiUrl}/api/me/releases/${releaseId}/tracks/${track.id}/finalize`)
  if (!finRes.ok()) return { ok: false, step: 'finalize', status: finRes.status() }
  return { ok: true, track }
}
