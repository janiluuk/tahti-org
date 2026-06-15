// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text)',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 500 }}>Something went wrong</h1>
      <p style={{ color: 'var(--platform-muted)', maxWidth: '32rem' }}>
        We hit an unexpected error loading this page. You can try again, or head back to the
        homepage.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.5rem',
            background: 'var(--cyan)',
            color: 'var(--bg)',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--card-hover)',
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          Go home
        </a>
      </div>
    </div>
  )
}
