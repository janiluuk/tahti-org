// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { submitSupportContact } from './actions'

export function SupportContactForm({ defaultEmail }: { defaultEmail?: string }) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const { error: err } = await submitSupportContact(new FormData(e.currentTarget))
    setPending(false)
    if (err) {
      setError(err)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <p>
        We received your message. Expect a reply within two business days for engagement and billing
        questions.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="brand-form" style={{ maxWidth: '32rem' }}>
      {!defaultEmail ? (
        <label>
          Your email
          <input name="contactEmail" type="email" required />
        </label>
      ) : null}
      <label>
        Category
        <select name="category" defaultValue="OTHER">
          <option value="ENGAGEMENT_DISPUTE">Engagement units</option>
          <option value="TECHNICAL">Technical</option>
          <option value="FINANCIAL">Billing / payouts</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label>
        Subject
        <input name="subject" required maxLength={200} />
      </label>
      <label>
        Message
        <textarea name="message" required rows={6} maxLength={5000} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send message'}
      </button>
      {error ? <p style={{ color: 'var(--coral)' }}>{error}</p> : null}
    </form>
  )
}
