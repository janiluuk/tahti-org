// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'

const DEFAULT_ITEMS = [
  'Call to order',
  'Quorum check',
  'Adoption of agenda',
  'Review of previous minutes',
  'Board report',
  'Financial report',
  'Motions',
  'Election of board (if applicable)',
  'Any other business',
  'Close',
]

export function AgmAgendaBuilder() {
  const [items, setItems] = useState<string[]>(DEFAULT_ITEMS)
  const [copied, setCopied] = useState(false)

  function update(i: number, val: string) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? val : item)))
  }

  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addItem() {
    setItems((prev) => [...prev, ''])
  }

  function moveUp(i: number) {
    if (i === 0) return
    setItems((prev) => {
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }

  function moveDown(i: number) {
    if (i === items.length - 1) return
    setItems((prev) => {
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }

  async function copyAgenda() {
    const text = items
      .filter(Boolean)
      .map((item, i) => `${i + 1}. ${item}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="admin-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h2>Agenda builder</h2>
        <button onClick={copyAgenda} className="admin-btn" style={{ minWidth: 120 }}>
          {copied ? 'Copied ✓' : 'Copy agenda'}
        </button>
      </div>

      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span
              style={{
                color: 'var(--muted)',
                fontSize: '0.75rem',
                width: '1.5rem',
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {i + 1}.
            </span>
            <input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
              className="admin-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={() => moveUp(i)}
              disabled={i === 0}
              className="admin-btn admin-btn--icon"
              title="Move up"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => moveDown(i)}
              disabled={i === items.length - 1}
              className="admin-btn admin-btn--icon"
              title="Move down"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              onClick={() => remove(i)}
              className="admin-btn admin-btn--danger admin-btn--icon"
              title="Remove"
              aria-label="Remove item"
            >
              ×
            </button>
          </li>
        ))}
      </ol>

      <button onClick={addItem} className="admin-btn" style={{ marginTop: '0.75rem' }}>
        + Add item
      </button>
    </section>
  )
}
