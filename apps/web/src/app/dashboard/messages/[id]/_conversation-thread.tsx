'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Button, ButtonIcon } from '@tahti/ui'
import { sendMessage, type ConversationDetail, type MessageView } from '../actions'
import { MentionTextarea } from '../_mention-textarea'
import { EmojiPicker } from '../_emoji-picker'

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Renders @username tokens as links to that user's profile. */
function renderBody(body: string) {
  const parts = body.split(/(@[a-zA-Z0-9_-]+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <Link key={i} href={`/u/${part.slice(1)}`} className="dm-message__mention">
          {part}
        </Link>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function ConversationThread({
  conversationId,
  initial,
}: {
  conversationId: string
  initial: ConversationDetail
}) {
  const [messages, setMessages] = useState<MessageView[]>(initial.messages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function submit() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    const res = await sendMessage(conversationId, body)
    if (res.error || !res.message) {
      setError(res.error ?? 'Failed to send message')
      setSending(false)
      return
    }
    setMessages((prev) => [...prev, res.message!])
    setDraft('')
    setSending(false)
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  return (
    <div className="dm-thread">
      <div className="dm-thread__messages">
        {messages.length === 0 ? (
          <p className="studio-empty studio-mt-sm">
            No messages yet — say hi to {initial.otherUser.displayName}.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`dm-message${m.isMine ? ' dm-message--mine' : ''}`}>
              <div className="dm-message__bubble">{renderBody(m.body)}</div>
              <div className="dm-message__meta">{fmtTime(m.createdAt)}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="dm-thread__composer">
        <MentionTextarea
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          placeholder={`Message @${initial.otherUser.username}… (@ to mention someone)`}
          disabled={sending}
        />
        <div className="dm-thread__composer-actions">
          <EmojiPicker onSelect={(emoji) => setDraft((prev) => prev + emoji)} />
          <Button onClick={submit} disabled={sending || !draft.trim()} variant="primary" size="sm">
            <ButtonIcon name="send" />
            Send
          </Button>
        </div>
        {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
      </div>
    </div>
  )
}
