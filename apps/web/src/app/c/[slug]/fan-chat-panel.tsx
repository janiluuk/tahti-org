// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { LiveChatPanel, type LiveChatMessage } from '@tahti/ui'
import { resolveClientApiUrl } from '@/lib/api-url'
import { searchChatMentions, useCentrifugoChat } from '@/hooks/use-centrifugo-chat'

const API_BASE = resolveClientApiUrl()

export default function FanChatPanel({ slug }: { slug: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [channel, setChannel] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [input, setInput] = useState('')
  const [accessError, setAccessError] = useState<string | null>(null)

  const { messages, status, error, setError, scrollRef, publish } = useCentrifugoChat({
    token,
    channel,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const access = await fetch(`${API_BASE}/api/chat/${slug}/access`, { credentials: 'include' })
      if (!access.ok || cancelled) return
      const data = (await access.json()) as { canJoinFanChat?: boolean }
      if (!data.canJoinFanChat) return

      const res = await fetch(`${API_BASE}/api/chat/${slug}/fan-token`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok || cancelled) {
        if (res.status === 403) setAccessError('Fan chat is for active subscribers.')
        return
      }
      const tok = (await res.json()) as { token: string; handle: string; channel: string }
      setToken(tok.token)
      setHandle(tok.handle)
      setChannel(tok.channel)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [slug])

  function sendMessage() {
    if (!handle || !input.trim()) return
    if (
      publish({
        handle,
        text: input,
        supporter: true,
      })
    ) {
      setInput('')
      setError(null)
    }
  }

  if (!token && !accessError) return null

  const liveMessages: LiveChatMessage[] = messages.map((m) => ({
    id: m.id,
    handle: m.handle,
    text: m.text,
    tone: 'supporter',
    ts: m.ts,
  }))

  return (
    <LiveChatPanel
      surface="channel"
      compact
      title="FAN CHAT"
      connected={status === 'connected'}
      messages={liveMessages}
      messagesRef={scrollRef}
      inputValue={input}
      onInputChange={setInput}
      onSend={sendMessage}
      inputPlaceholder="Fans only…"
      inputDisabled={status !== 'connected'}
      sendDisabled={status !== 'connected'}
      error={accessError ?? error}
      readOnly={!token}
      onSearchMentions={searchChatMentions}
    />
  )
}
