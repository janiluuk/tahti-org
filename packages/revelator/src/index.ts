// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Revelator white-label distribution client (M7).
// When REVELATOR_API_KEY is unset the client runs in stub mode for CI/dev.

export interface RevelatorTrackInput {
  position: number
  title: string
  isrc: string | null
  durationSec: number | null
}

export interface RevelatorReleaseInput {
  tahtiReleaseId: string
  title: string
  type: string
  releaseDate: string
  upc: string | null
  pLine: string | null
  cLine: string | null
  labelImprint: string | null
  artistDisplayName: string
  artistUsername: string
  tracks: RevelatorTrackInput[]
}

export interface RevelatorSubmitResult {
  revelatorId: string
  status: 'submitted'
}

export async function submitReleaseToRevelator(
  input: RevelatorReleaseInput,
): Promise<RevelatorSubmitResult> {
  const apiKey = process.env.REVELATOR_API_KEY

  if (!apiKey) {
    return {
      revelatorId: `stub-${input.tahtiReleaseId}`,
      status: 'submitted',
    }
  }

  const res = await fetch('https://api.revelator.com/v1/releases', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      externalId: input.tahtiReleaseId,
      title: input.title,
      releaseType: input.type,
      releaseDate: input.releaseDate,
      upc: input.upc,
      pLine: input.pLine,
      cLine: input.cLine,
      label: input.labelImprint,
      artistName: input.artistDisplayName,
      tracks: input.tracks.map((t) => ({
        sequence: t.position,
        title: t.title,
        isrc: t.isrc,
        durationSeconds: t.durationSec,
      })),
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    id?: string
    releaseId?: string
    message?: string
  }

  if (!res.ok) {
    throw new Error(data.message ?? `Revelator submit failed (${res.status})`)
  }

  const revelatorId = data.id ?? data.releaseId
  if (!revelatorId) throw new Error('Revelator response missing release id')

  return { revelatorId: String(revelatorId), status: 'submitted' }
}
