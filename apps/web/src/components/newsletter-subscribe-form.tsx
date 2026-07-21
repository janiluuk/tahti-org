'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState, type FormEvent } from 'react'

function IconMail() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" fill="currentColor" opacity="0.15" />
      <path
        d="M1.5 4l6.5 4.5L14.5 4M1.5 12.5v-8a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Props = {
  artistUsername: string
  artistDisplayName: string
  isLoggedIn: boolean
}

type Status = 'idle' | 'loading' | 'sent' | 'subscribed' | 'error'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

/** Logged-in viewer — subscribe/unsubscribe with one click using the account's own email. */
function LoggedInToggle({ artistUsername }: { artistUsername: string }) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/me/newsletter/subscription/${artistUsername}`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { subscribed: boolean } | null) => {
        if (!cancelled && data) setSubscribed(data.subscribed)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [artistUsername])

  async function toggle() {
    if (subscribed === null || busy) return
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/newsletter/subscription/${artistUsername}`, {
        method: subscribed ? 'DELETE' : 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const data = (await res.json()) as { subscribed: boolean }
        setSubscribed(data.subscribed)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`prof-newsletter-btn${subscribed ? ' prof-newsletter-btn--active' : ''}`}
      onClick={() => void toggle()}
      disabled={subscribed === null || busy}
      aria-pressed={subscribed ?? false}
      title={subscribed ? 'Subscribed to email updates' : 'Get email updates'}
    >
      <IconMail />
      {subscribed ? 'Subscribed' : 'Email updates'}
    </button>
  )
}

/** Anonymous visitor — collapsed button expands to the email-entry form. */
function AnonymousForm({ artistUsername, artistDisplayName }: Omit<Props, 'isLoggedIn'>) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
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

  if (!open) {
    return (
      <button type="button" className="prof-newsletter-btn" onClick={() => setOpen(true)}>
        <IconMail />
        Email updates
      </button>
    )
  }

  return (
    <div className="nl-subscribe" aria-labelledby="nl-subscribe-heading">
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
    </div>
  )
}

export function NewsletterSubscribeForm({ artistUsername, artistDisplayName, isLoggedIn }: Props) {
  return isLoggedIn ? (
    <LoggedInToggle artistUsername={artistUsername} />
  ) : (
    <AnonymousForm artistUsername={artistUsername} artistDisplayName={artistDisplayName} />
  )
}
