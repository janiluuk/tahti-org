// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { startConversation } from '@/app/dashboard/messages/actions'

function IconMessage() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 3.5h12a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H6l-3 2.5V12H2a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Grouped with the "Support" button on the profile CTA row — starts (or
 * resumes) a direct-message conversation with this artist. Shows a brand-surface
 * interstitial before leaving for Studio Messages. */
export function SendMessageButton({ artistUsername }: { artistUsername: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  async function prepare() {
    setPending(true)
    setError(null)
    const res = await startConversation(artistUsername)
    setPending(false)
    if (res.error) {
      if (res.unauthorized) {
        router.push(`/login?next=${encodeURIComponent(pathname || '/')}`)
        return
      }
      setError(res.error)
      return
    }
    if (res.conversationId) {
      setConversationId(res.conversationId)
      setConfirmOpen(true)
    }
  }

  function continueToStudio() {
    if (!conversationId) return
    router.push(`/dashboard/messages/${conversationId}`)
  }

  return (
    <>
      <button
        type="button"
        className="prof-message-btn"
        onClick={() => void prepare()}
        disabled={pending}
        title="Send a message"
        aria-label="Send a message"
      >
        <IconMessage />
        Message
      </button>
      {error && <p className="prof-message-btn__error">{error}</p>}
      {confirmOpen && (
        <div className="prof-message-interstitial" role="dialog" aria-modal="true">
          <div className="prof-message-interstitial__card">
            <p className="prof-message-interstitial__title">Open Messages?</p>
            <p className="prof-message-interstitial__body">
              Your conversation continues in Studio Messages — the artist dashboard inbox.
            </p>
            <div className="prof-message-interstitial__actions">
              <button
                type="button"
                className="prof-message-interstitial__cancel"
                onClick={() => setConfirmOpen(false)}
              >
                Stay here
              </button>
              <button
                type="button"
                className="prof-message-interstitial__continue"
                onClick={continueToStudio}
              >
                Continue to Messages
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
