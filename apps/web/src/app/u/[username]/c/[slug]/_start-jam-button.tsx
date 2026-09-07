// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoginPromptModal } from '@/components/login-prompt-modal'
import { createJam } from '@/lib/jam-client'

function IconJam() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.5 5.5 10.5 8 6.5 10.5V5.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Starts a Tahti Jam (synced group-listening session) from this public
 * playlist and takes the host straight to /jam/[code]. Guests join the same
 * page by pasting the code or following the link the host copies there. */
export function StartJamButton({ slug }: { slug: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setPending(true)
    setError(null)
    try {
      const session = await createJam(slug)
      router.push(`/jam/${session.code}`)
    } catch (err) {
      if (err instanceof Error && /401|unauthor/i.test(err.message)) {
        setShowLogin(true)
      } else {
        setError("Couldn't start a Jam for this playlist.")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="prof-embed-btn"
        onClick={() => void start()}
        disabled={pending}
        title="Start a Tahti Jam"
      >
        <IconJam />
        {pending ? 'Starting…' : 'Start a Jam'}
      </button>
      {error ? <span className="prof-list-meta">{error}</span> : null}
      {showLogin ? (
        <LoginPromptModal
          message="Sign in to start a Tahti Jam."
          onClose={() => setShowLogin(false)}
        />
      ) : null}
    </>
  )
}
