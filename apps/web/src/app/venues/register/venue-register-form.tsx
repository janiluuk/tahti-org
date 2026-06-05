// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { registerVenue } from './actions'

export function VenueRegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const form = e.currentTarget
    const result = await registerVenue(new FormData(form))
    if (result?.error) {
      setError(result.error)
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="brand-form" style={{ maxWidth: '32rem' }}>
      <label>
        URL slug
        <input name="slug" required minLength={2} maxLength={64} placeholder="kulttuuritalo" />
      </label>
      <label>
        Venue name
        <input name="name" required maxLength={120} />
      </label>
      <label>
        Street address
        <input name="address" required maxLength={200} />
      </label>
      <label>
        City
        <input name="city" required maxLength={80} />
      </label>
      <label>
        Country code
        <input name="countryCode" defaultValue="FI" maxLength={2} />
      </label>
      <label>
        Capacity (optional)
        <input name="capacity" type="number" min={1} />
      </label>
      <label>
        Description (optional)
        <textarea name="description" rows={4} maxLength={2000} />
      </label>
      <p className="brand-muted" style={{ fontSize: '0.85rem' }}>
        New venues are reviewed by the board before appearing in the public directory.
      </p>
      <button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit for review'}
      </button>
      {error ? <p style={{ color: 'var(--coral)' }}>{error}</p> : null}
    </form>
  )
}
