// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { FallbackMode } from '@tahti/shared'
import { Alert, Button, Field, Panel, Select, Text } from '@/components/ui'
import { updateChannelProgramme, type ProgrammeItemRow } from './programme-actions'

export default function ProgrammePanel({
  initial,
}: {
  initial: { fallbackMode: FallbackMode; items: ProgrammeItemRow[] }
}) {
  const router = useRouter()
  const [fallbackMode, setFallbackMode] = useState<FallbackMode>(initial.fallbackMode)
  const [rows, setRows] = useState(initial.items)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleFallback(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isFallback: !r.isFallback } : r)))
  }

  function move(id: string, dir: -1 | 1) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id)
      if (idx < 0) return prev
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const copy = [...prev]
      const [row] = copy.splice(idx, 1)
      copy.splice(next, 0, row!)
      return copy.map((r, i) => ({ ...r, fallbackOrder: i }))
    })
  }

  function save() {
    setError(null)
    setMessage(null)
    const inRotation = rows.filter((r) => r.isFallback)
    startTransition(async () => {
      const res = await updateChannelProgramme({
        fallbackMode,
        items: rows.map((r, i) => ({
          archiveItemId: r.id,
          isFallback: r.isFallback,
          fallbackOrder: inRotation.includes(r) ? i : undefined,
        })),
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('24/7 rotation saved.')
      router.refresh()
    })
  }

  const ready = rows.filter((r) => r.status === 'READY')

  return (
    <Panel
      title="24/7 archive rotation"
      headerTight
      description={
        <Text size="sm" tone="muted">
          Choose which sets play on your channel when you are offline. Shuffle favours sets that
          have not played recently; ordered follows the list below.
        </Text>
      }
    >
      <Field label="Rotation mode" htmlFor="fallback-mode">
        <Select
          id="fallback-mode"
          value={fallbackMode}
          disabled={isPending}
          onChange={(e) => setFallbackMode(e.target.value as FallbackMode)}
        >
          <option value="shuffle">Shuffle (fair rotation)</option>
          <option value="ordered">Ordered playlist</option>
        </Select>
      </Field>

      {ready.length === 0 ? (
        <Text size="sm" tone="muted" style={{ marginTop: '1rem' }}>
          Upload archive items first — only ready sets can join rotation.
        </Text>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
          {ready.map((row, index) => (
            <li
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0',
                borderBottom: '1px solid #eee',
              }}
            >
              <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={row.isFallback}
                  disabled={isPending}
                  onChange={() => toggleFallback(row.id)}
                />
                <span>{row.title}</span>
              </label>
              {fallbackMode === 'ordered' && row.isFallback && (
                <span style={{ display: 'flex', gap: '0.25rem' }}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending || index === 0}
                    onClick={() => move(row.id, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending || index === ready.length - 1}
                    onClick={() => move(row.id, 1)}
                  >
                    ↓
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <Alert variant="error" style={{ marginTop: '0.75rem' }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert variant="success" style={{ marginTop: '0.75rem' }}>
          {message}
        </Alert>
      )}

      <Button type="button" disabled={isPending || ready.length === 0} onClick={save}>
        {isPending ? 'Saving…' : 'Save rotation'}
      </Button>
    </Panel>
  )
}
