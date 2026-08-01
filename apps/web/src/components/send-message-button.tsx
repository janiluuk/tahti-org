// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { sendMessage, startConversation } from '@/app/dashboard/messages/actions'

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

/** Brand-surface compose sheet — starts (or resumes) a DM without dumping into Studio. */
export function SendMessageButton({ artistUsername }: { artistUsername: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const titleId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentConversationId, setSentConversationId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openComposer() {
    setError(null)
    setSentConversationId(null)
    setPending(true)
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
    setOpen(true)
  }

  async function submit() {
    const body = draft.trim()
    if (!body || pending) return
    setPending(true)
    setError(null)
    const started = await startConversation(artistUsername)
    if (started.error || !started.conversationId) {
      setPending(false)
      if (started.unauthorized) {
        router.push(`/login?next=${encodeURIComponent(pathname || '/')}`)
        return
      }
      setError(started.error ?? 'Could not open conversation')
      return
    }
    const sent = await sendMessage(started.conversationId, body)
    setPending(false)
    if (sent.error) {
      setError(sent.error)
      return
    }
    setDraft('')
    setSentConversationId(started.conversationId)
  }

  return (
    <>
      <button
        type="button"
        className="prof-message-btn"
        onClick={() => void openComposer()}
        disabled={pending && !open}
        title="Send a message"
        aria-label="Send a message"
      >
        <IconMessage />
        Message
      </button>
      {error && !open && <p className="prof-message-btn__error">{error}</p>}
      {open && (
        <div
          className="prof-message-sheet"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            className="prof-message-sheet__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="prof-message-sheet__header">
              <div>
                <h2 id={titleId} className="prof-message-sheet__title">
                  Message @{artistUsername}
                </h2>
                <p className="prof-message-sheet__sub">Stays on this page — no Studio redirect.</p>
              </div>
              <button
                type="button"
                className="prof-message-sheet__close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            {sentConversationId ? (
              <div className="prof-message-sheet__success">
                <p>Message sent.</p>
                <div className="prof-message-sheet__actions">
                  <button
                    type="button"
                    className="prof-message-sheet__secondary"
                    onClick={() => setOpen(false)}
                  >
                    Done
                  </button>
                  <a
                    href={`/dashboard/messages/${sentConversationId}`}
                    className="prof-message-sheet__primary"
                  >
                    Open full conversation
                  </a>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  className="prof-message-sheet__input"
                  rows={5}
                  maxLength={2000}
                  placeholder="Write your message…"
                  value={draft}
                  disabled={pending}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      void submit()
                    }
                  }}
                />
                {error && <p className="prof-message-btn__error">{error}</p>}
                <div className="prof-message-sheet__actions">
                  <button
                    type="button"
                    className="prof-message-sheet__secondary"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="prof-message-sheet__primary"
                    onClick={() => void submit()}
                    disabled={pending || !draft.trim()}
                  >
                    {pending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
