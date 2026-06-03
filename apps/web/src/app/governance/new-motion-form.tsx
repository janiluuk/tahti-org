// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { createMotion } from './actions'

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 16)
}

export default function NewMotionForm() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [openAt, setOpenAt] = useState(isoDaysFromNow(0))
  const [closeAt, setCloseAt] = useState(isoDaysFromNow(14))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createMotion({
        title,
        description,
        openAt: new Date(openAt).toISOString(),
        closeAt: new Date(closeAt).toISOString(),
      })
      if (res.error) {
        setError(res.error)
      } else {
        setTitle('')
        setDescription('')
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginBottom: '2rem',
          padding: '0.5rem 1rem',
          border: '1px solid #2563eb',
          color: '#2563eb',
          background: '#fff',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        + New motion
      </button>
    )
  }

  return (
    <div
      style={{
        marginBottom: '2rem',
        padding: '1.25rem',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>New motion (saved as draft)</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Motion title"
        style={inputStyle}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the motion…"
        rows={4}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.8rem', color: '#666' }}>
          Opens
          <input
            type="datetime-local"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0 }}
          />
        </label>
        <label style={{ fontSize: '0.8rem', color: '#666' }}>
          Closes
          <input
            type="datetime-local"
            value={closeAt}
            onChange={(e) => setCloseAt(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0 }}
          />
        </label>
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: '0.8rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={submit}
          disabled={pending || !title.trim() || !description.trim()}
          style={{
            padding: '0.45rem 1rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {pending ? 'Saving…' : 'Create draft'}
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{
            padding: '0.45rem 1rem',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  marginBottom: '0.75rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.875rem',
  fontFamily: 'inherit',
}
