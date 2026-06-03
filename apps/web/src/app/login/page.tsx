// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const result = await login({
      email: form.get('email') as string,
      password: form.get('password') as string,
    })

    if (result.error) {
      setError(result.error)
      setPending(false)
    } else {
      // Full page navigation so the browser sends the new session cookie
      window.location.href = '/dashboard'
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Log in</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {error && <p style={{ color: 'red' }}>{error}</p>}

        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
        Don&apos;t have an account? <a href="/join">Create one</a>
      </p>
    </div>
  )
}
