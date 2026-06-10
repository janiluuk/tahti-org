// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Revelator white-label distribution client (M7).
// When REVELATOR_API_KEY is unset the client runs in stub mode for CI/dev.

import { readSecret } from './read-secret.js'

function revelatorApiKey(): string {
  return readSecret('REVELATOR_API_KEY', 'REVELATOR_API_KEY_FILE')
}

/** True when a live API key is configured (env or Docker secret file). */
export function isRevelatorConfigured(): boolean {
  return revelatorApiKey() !== ''
}

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
  const apiKey = revelatorApiKey()

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

export interface RevelatorRoyaltyReleaseRef {
  tahtiReleaseId: string
  revelatorId: string
}

export interface RevelatorRoyaltyPeriod {
  /** Calendar year (UTC). */
  year: number
  /** 1–12 */
  month: number
}

export interface RevelatorRoyaltyRow {
  tahtiReleaseId: string
  revelatorId: string
  periodStart: string
  periodEnd: string
  amountCents: number
  currency: string
  streams: number | null
}

function periodBounds(period: RevelatorRoyaltyPeriod): { start: string; end: string } {
  const monthStart = new Date(Date.UTC(period.year, period.month - 1, 1))
  const monthEnd = new Date(Date.UTC(period.year, period.month, 0))
  const isoDate = (d: Date) => d.toISOString().slice(0, 10)
  return { start: isoDate(monthStart), end: isoDate(monthEnd) }
}

function stubRoyaltyAmount(revelatorId: string, period: RevelatorRoyaltyPeriod): number {
  let hash = 0
  const key = `${revelatorId}:${period.year}-${period.month}`
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  // €0.50 – €49.99 stub range for dev/CI
  return 50 + (hash % 4950)
}

function stubStreamCount(revelatorId: string, period: RevelatorRoyaltyPeriod): number {
  let hash = 0
  const key = `streams:${revelatorId}:${period.year}-${period.month}`
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 17 + key.charCodeAt(i)) >>> 0
  }
  return 10 + (hash % 990)
}

/** Pull royalty rows for the given releases and calendar month (UTC). */
export async function fetchRoyaltyReports(
  releases: RevelatorRoyaltyReleaseRef[],
  period: RevelatorRoyaltyPeriod,
): Promise<RevelatorRoyaltyRow[]> {
  if (releases.length === 0) return []

  const { start, end } = periodBounds(period)
  const apiKey = revelatorApiKey()

  if (!apiKey) {
    return releases.map((r) => ({
      tahtiReleaseId: r.tahtiReleaseId,
      revelatorId: r.revelatorId,
      periodStart: start,
      periodEnd: end,
      amountCents: stubRoyaltyAmount(r.revelatorId, period),
      currency: 'EUR',
      streams: stubStreamCount(r.revelatorId, period),
    }))
  }

  const rows: RevelatorRoyaltyRow[] = []

  for (const release of releases) {
    const url = new URL('https://api.revelator.com/v1/royalties')
    url.searchParams.set('releaseId', release.revelatorId)
    url.searchParams.set('from', start)
    url.searchParams.set('to', end)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    const data = (await res.json().catch(() => ({}))) as {
      amountCents?: number
      amount?: number
      currency?: string
      streams?: number
      message?: string
    }

    if (!res.ok) {
      throw new Error(
        data.message ?? `Revelator royalty fetch failed for ${release.revelatorId} (${res.status})`,
      )
    }

    const amountCents =
      typeof data.amountCents === 'number'
        ? data.amountCents
        : typeof data.amount === 'number'
          ? Math.round(data.amount * 100)
          : 0

    rows.push({
      tahtiReleaseId: release.tahtiReleaseId,
      revelatorId: release.revelatorId,
      periodStart: start,
      periodEnd: end,
      amountCents,
      currency: data.currency ?? 'EUR',
      streams: typeof data.streams === 'number' ? data.streams : null,
    })
  }

  return rows
}
