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
 * resumes) a direct-message conversation with this artist and jumps straight
 * to the thread. Not shown on your own profile (guarded by the caller, same
 * as FollowButton). */
export function SendMessageButton({ artistUsername }: { artistUsername: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
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
    if (res.conversationId) router.push(`/dashboard/messages/${res.conversationId}`)
  }

  return (
    <>
      <button
        type="button"
        className="prof-message-btn"
        onClick={() => void open()}
        disabled={pending}
        title="Send a message"
        aria-label="Send a message"
      >
        <IconMessage />
        Message
      </button>
      {error && <p className="prof-message-btn__error">{error}</p>}
    </>
  )
}
