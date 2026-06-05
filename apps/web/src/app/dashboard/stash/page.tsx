// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Heading, PageShell } from '@tahti/ui'
import { StashClient } from './stash-client'

interface StashFile {
  id: string
  filename: string
  contentType: string
  sizeBytes: string
  format: string | null
  bitDepth: number | null
  sampleRate: number | null
  createdAt: string
  updatedAt: string
  shareCount: number
  shares: Array<{
    id: string
    granteeUsername: string | null
    token: string
    permission: string
    fileCount: number
    expiresAt: string | null
    createdAt: string
  }>
}

interface StorageInfo {
  usedBytes: string
  softTargetBytes: string
}

function fmtBytes(bytes: number): string {
  if (bytes < 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`
}

export default async function StashPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookieHeader = `tahti_session=${sessionCookie.value}`

  let files: StashFile[] = []
  let storage: StorageInfo | null = null

  try {
    const [stashRes, meRes] = await Promise.all([
      fetch(`${apiUrl}/api/me/stash`, { headers: { Cookie: cookieHeader }, cache: 'no-store' }),
      fetch(`${apiUrl}/api/auth/me`, { headers: { Cookie: cookieHeader }, cache: 'no-store' }),
    ])
    if (stashRes.ok) files = (await stashRes.json()) as StashFile[]
    if (meRes.ok) {
      const me = (await meRes.json()) as { storage?: StorageInfo }
      storage = me.storage ?? null
    }
  } catch {
    // ignore
  }

  const usedBytes = storage ? Number(storage.usedBytes) : 0
  const targetBytes = storage ? Number(storage.softTargetBytes) : 0
  const pctUsed = targetBytes > 0 ? Math.min(100, Math.round((usedBytes / targetBytes) * 100)) : 0

  return (
    <PageShell size="md">
      <div className="studio-page-header stash-page-header">
        <div>
          <Heading level={1}>My Stash</Heading>
          {storage && (
            <p className="stash-storage-meta">
              Private storage · {fmtBytes(usedBytes)} used of {fmtBytes(targetBytes)} · Paid plan
            </p>
          )}
        </div>
      </div>

      {storage && (
        <div className="studio-storage">
          <div className="studio-storage-track">
            <div
              className={`studio-storage-fill${pctUsed >= 80 ? ' studio-storage-fill--warn' : ''}`}
              style={{ ['--studio-storage-pct' as string]: `${pctUsed}%` }}
            />
          </div>
        </div>
      )}

      <StashClient initialFiles={files} />
    </PageShell>
  )
}
