'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, type FormEvent } from 'react'

type Props = {
  artistUsername: string
  artistDisplayName: string
}

type Status = 'idle' | 'loading' | 'sent' | 'subscribed' | 'error'

export function NewsletterSubscribeForm({ artistUsername, artistDisplayName }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
    try {
      const res = await fetch(`${apiBase}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, artistUsername }),
      })
      const body = (await res.json()) as { status?: string; error?: string }
      if (!res.ok) {
        setStatus('error')
        setMessage(body.error ?? 'Subscription failed')
        return
      }
      if (body.status === 'already_subscribed') {
        setStatus('subscribed')
        setMessage('You are already subscribed.')
        return
      }
      setStatus('sent')
      setMessage('Check your email to confirm your subscription.')
      setEmail('')
    } catch {
      setStatus('error')
      setMessage('Network error — try again later.')
    }
  }

  return (
    <section className="nl-subscribe" aria-labelledby="nl-subscribe-heading">
      <h2 id="nl-subscribe-heading" className="nl-subscribe-title">
        Email updates
      </h2>
      <p className="nl-subscribe-desc">
        Get notified when {artistDisplayName} sends a newsletter. Double opt-in — unsubscribe any
        time.
      </p>
      <form className="nl-subscribe-form" onSubmit={onSubmit}>
        <label htmlFor={`nl-email-${artistUsername}`} className="sr-only">
          Email address
        </label>
        <input
          id={`nl-email-${artistUsername}`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          disabled={status === 'loading' || status === 'sent'}
          onChange={(e) => setEmail(e.target.value)}
          className="nl-subscribe-input"
        />
        <button
          type="submit"
          disabled={status === 'loading' || status === 'sent'}
          className="nl-subscribe-btn"
        >
          {status === 'loading' ? 'Sending…' : 'Subscribe'}
        </button>
      </form>
      {message && (
        <p
          className={
            status === 'error' ? 'nl-subscribe-msg nl-subscribe-msg--err' : 'nl-subscribe-msg'
          }
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  )
}
