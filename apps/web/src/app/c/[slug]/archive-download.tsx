// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type GateStatus = {
  repostRequired: boolean
  followRequired: boolean
  repostSatisfied: boolean
  followSatisfied: boolean
  canDownload: boolean
}

function listenerFingerprint(): string {
  if (typeof window === 'undefined') return 'ssr'
  const key = 'tahti_listener_fp'
  let fp = localStorage.getItem(key)
  if (!fp) {
    fp = `fp_${Math.random().toString(36).slice(2)}_${Date.now()}`
    localStorage.setItem(key, fp)
  }
  return fp
}

export function ArchiveDownloadButton({
  channelSlug,
  artistUsername,
  itemId,
  repostToDownload,
  followToDownload,
}: {
  channelSlug: string
  artistUsername: string
  itemId: string
  repostToDownload: boolean
  followToDownload: boolean
}) {
  const [gates, setGates] = useState<GateStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)

  const needsGate = repostToDownload || followToDownload

  const refreshGates = useCallback(async () => {
    if (!needsGate) return
    const fp = listenerFingerprint()
    const res = await fetch(
      `${API_URL}/api/v1/c/${encodeURIComponent(channelSlug)}/archive/${itemId}/download-gates?fp=${encodeURIComponent(fp)}`,
      { credentials: 'include' },
    )
    if (res.ok) setGates((await res.json()) as GateStatus)
  }, [channelSlug, itemId, needsGate])

  useEffect(() => {
    void refreshGates()
  }, [refreshGates])

  useEffect(() => {
    if (!followToDownload) return
    void (async () => {
      const res = await fetch(
        `${API_URL}/api/v1/artists/${encodeURIComponent(artistUsername)}/follow`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = (await res.json()) as { following: boolean }
        setFollowing(data.following)
      }
    })()
  }, [artistUsername, followToDownload])

  async function acknowledgeRepost() {
    setError(null)
    const fp = listenerFingerprint()
    const res = await fetch(
      `${API_URL}/api/v1/c/${encodeURIComponent(channelSlug)}/archive/${itemId}/repost-ack`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fp }),
      },
    )
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Could not record repost')
      return
    }
    await refreshGates()
  }

  async function toggleFollow() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(
        `${API_URL}/api/v1/artists/${encodeURIComponent(artistUsername)}/follow`,
        { method: following ? 'DELETE' : 'POST', credentials: 'include' },
      )
      if (res.status === 401) {
        setError('Sign in to follow this artist')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Follow failed')
        return
      }
      const data = (await res.json()) as { following: boolean }
      setFollowing(data.following)
      await refreshGates()
    } finally {
      setLoading(false)
    }
  }

  async function download() {
    setError(null)
    setLoading(true)
    try {
      const fp = listenerFingerprint()
      const res = await fetch(
        `${API_URL}/api/v1/c/${encodeURIComponent(channelSlug)}/archive/${itemId}/download?fp=${encodeURIComponent(fp)}`,
        { credentials: 'include' },
      )
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Download unavailable')
        await refreshGates()
        return
      }
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  if (!needsGate) {
    return (
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}
      >
        {loading ? 'Preparing…' : 'Download'}
      </button>
    )
  }

  const canDownload = gates?.canDownload ?? false

  return (
    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
      {repostToDownload && !gates?.repostSatisfied && (
        <button
          type="button"
          onClick={() => void acknowledgeRepost()}
          style={{ marginRight: '0.5rem' }}
        >
          I shared this track
        </button>
      )}
      {followToDownload && (
        <button
          type="button"
          onClick={() => void toggleFollow()}
          disabled={loading}
          style={{ marginRight: '0.5rem' }}
        >
          {following ? 'Following' : 'Follow artist'}
        </button>
      )}
      {followToDownload && (
        <span style={{ color: '#888' }}>
          {' '}
          or{' '}
          <Link href={`/u/${artistUsername}/subscribe`} style={{ color: '#2563eb' }}>
            subscribe
          </Link>
        </span>
      )}
      <div style={{ marginTop: '0.35rem' }}>
        <button type="button" onClick={() => void download()} disabled={loading || !canDownload}>
          {loading ? 'Preparing…' : 'Download'}
        </button>
      </div>
      {error && <p style={{ color: '#b91c1c', margin: '0.35rem 0 0' }}>{error}</p>}
    </div>
  )
}
