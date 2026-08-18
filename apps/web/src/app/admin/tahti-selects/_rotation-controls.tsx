'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SortableList } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export interface RotationItem {
  id: string
  position: number
  addedBy: string
  archiveItemId: string
  title: string
  durationSec: number | null
  license: string
  artistName: string
  channelSlug: string
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

export function SelectsGenerateControls() {
  const router = useRouter()
  const [mode, setMode] = useState<'add' | 'replace'>('add')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function generate() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(`${API_URL}/api/admin/tahti-selects/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = (await response.json().catch(() => ({}))) as { added?: number; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Generation failed')
      setMessage(`${mode === 'replace' ? 'Replaced with' : 'Added'} ${data.added ?? 0} top tracks.`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="admin-selects-generator">
      <label htmlFor="selects-generate-mode">Top-played playlist</label>
      <select
        id="selects-generate-mode"
        className="admin-search-input"
        value={mode}
        disabled={pending}
        onChange={(event) => setMode(event.target.value as 'add' | 'replace')}
      >
        <option value="add">Add to current list</option>
        <option value="replace">Replace current list</option>
      </select>
      <button
        type="button"
        className="admin-btn admin-btn--sm admin-selects-generator__button"
        aria-label="Generate playlist from top-played tracks"
        title="Generate playlist from top-played tracks"
        disabled={pending}
        onClick={() => void generate()}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m4 20 11-11m-8-3 2 2m7-5 1.1 2.9L20 7l-2.9 1.1L16 11l-1.1-2.9L12 7l2.9-1.1L16 3ZM5 3l.7 1.8L7.5 5.5l-1.8.7L5 8l-.7-1.8-1.8-.7 1.8-.7L5 3Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {message ? <span className="admin-stat-sub">{message}</span> : null}
    </div>
  )
}

export function SelectsRotationList({ initialItems }: { initialItems: RotationItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reorder(next: RotationItem[]) {
    const previous = items
    setItems(next)
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/admin/tahti-selects/reorder`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: next.map((item) => item.id) }),
      })
      if (!response.ok) throw new Error()
      router.refresh()
    } catch {
      setItems(previous)
      setError('Could not save the new order')
    } finally {
      setPending(false)
    }
  }

  async function remove(item: RotationItem) {
    const previous = items
    setItems((current) => current.filter((candidate) => candidate.id !== item.id))
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/admin/tahti-selects/items/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) throw new Error()
      router.refresh()
    } catch {
      setItems(previous)
      setError(`Could not remove “${item.title}”`)
    } finally {
      setPending(false)
    }
  }

  if (items.length === 0) {
    return <p className="admin-stat-sub">Nothing in rotation yet — generate or add tracks below.</p>
  }

  return (
    <>
      <SortableList
        items={items}
        itemId={(item) => item.id}
        onReorder={(next) => void reorder(next)}
        className="admin-rotation-list"
        renderItem={(item, index, sortable) => (
          <div
            ref={sortable.ref}
            className={`admin-rotation-row${sortable.isDragging ? ' is-dragging' : ''}`}
          >
            <button
              ref={sortable.handleRef}
              type="button"
              className="admin-rotation-row__move"
              aria-label={`Reorder “${item.title}”`}
              title="Drag to reorder"
              disabled={pending}
            >
              ⠿
            </button>
            <span className="admin-rotation-row__index">{index + 1}</span>
            <span className="admin-rotation-row__body">
              <span className="admin-rotation-row__title">{item.title}</span>
              <span className="admin-rotation-row__meta">
                <a
                  href={resolveChannelUrl(item.channelSlug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.artistName} ↗
                </a>{' '}
                · {formatDuration(item.durationSec)} · {item.license.replace(/_/g, ' ')} · added by{' '}
                {item.addedBy}
              </span>
            </span>
            <button
              type="button"
              className="admin-rotation-row__remove"
              aria-label={`Remove “${item.title}” from rotation`}
              title="Remove from rotation"
              disabled={pending}
              onClick={() => void remove(item)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M6 7.5v4M10 7.5v4M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}
      />
      {pending ? <p className="admin-stat-sub">Saving rotation…</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
    </>
  )
}
