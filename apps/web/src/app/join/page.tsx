// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

'use client'

import { useState } from 'react'
import { register } from './actions'

export default function JoinPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const result = await register({
      email: form.get('email') as string,
      password: form.get('password') as string,
      username: form.get('username') as string,
      displayName: form.get('displayName') as string,
    })

    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
        <h1>Check your email</h1>
        <p>
          We&apos;ve sent a verification link to your email address. Click it to activate your
          account.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Create an artist account</h1>
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
          <span style={{ display: 'block', marginBottom: 4 }}>Display name</span>
          <input
            name="displayName"
            type="text"
            required
            autoComplete="name"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>
            Username <small>(your channel URL: tahti.fi/u/&lt;username&gt;)</small>
          </span>
          <input
            name="username"
            type="text"
            required
            pattern="[a-z0-9_-]+"
            autoComplete="username"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
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
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
