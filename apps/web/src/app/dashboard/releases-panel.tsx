// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createRelease, publishRelease } from './release-actions.js'

interface ReleaseSummary {
  id: string
  title: string
  type: string
  state: string
  releaseDate: string
  _count: { tracks: number }
}

export default function ReleasesPanel({
  initial,
  username,
}: {
  initial: ReleaseSummary[]
  username: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  function addRelease() {
    setError(null)
    if (!title.trim()) return
    startTransition(async () => {
      const res = await createRelease({
        title: title.trim(),
        type: 'SINGLE',
        releaseDate: new Date().toISOString().slice(0, 10),
        tracks: [{ title: title.trim() }],
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setTitle('')
      router.refresh()
    })
  }

  function publish(id: string) {
    startTransition(async () => {
      await publishRelease(id)
      router.refresh()
    })
  }

  return (
    <section
      style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Releases</h2>
        <a href={`/u/${username}`} style={{ fontSize: '0.85rem', color: '#2563eb' }}>
          Public profile ↗
        </a>
      </div>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Publish releases on your profile. Full audio upload pipeline coming later — v1 uses track
        metadata (link archive items in a future update).
      </p>

      {initial.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
          {initial.map((r) => (
            <li
              key={r.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <span>
                {r.title} · {r.state} · {r._count.tracks} track(s)
              </span>
              {r.state === 'DRAFT' && (
                <button
                  onClick={() => publish(r.id)}
                  disabled={isPending}
                  style={{ border: '1px solid #ccc', borderRadius: 4, padding: '0.2rem 0.5rem' }}
                >
                  Publish
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <input
          placeholder="Release title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          onClick={addRelease}
          disabled={isPending}
          style={{
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            padding: '0.5rem 1rem',
          }}
        >
          Add draft
        </button>
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p>}
    </section>
  )
}
