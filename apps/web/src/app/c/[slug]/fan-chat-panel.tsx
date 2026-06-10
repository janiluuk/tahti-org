'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'
import { LiveChatPanel, type LiveChatMessage } from '@tahti/ui'

interface ChatMessage {
  id: string
  handle: string
  text: string
  ts: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export default function FanChatPanel({ slug }: { slug: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [channel, setChannel] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const msgIdRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)

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
        if (res.status === 403) setError('Fan chat is for active subscribers.')
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

  useEffect(() => {
    if (!token || !channel) return
    const wsUrl =
      process.env.NEXT_PUBLIC_CENTRIFUGO_WS ?? 'ws://localhost:8000/connection/websocket'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, connect: { token, name: 'js' } }))
    }

    ws.onmessage = (ev) => {
      for (const line of (ev.data as string).split('\n')) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as {
            connect?: { client: string }
            push?: { channel: string; pub: { data: { handle: string; text: string; ts: number } } }
          }
          if (msg.connect) {
            setStatus('connected')
            ws.send(JSON.stringify({ id: 2, subscribe: { channel } }))
          }
          if (msg.push?.pub?.data) {
            const d = msg.push.pub.data
            setMessages((prev) => [
              ...prev,
              { id: `${d.ts}-${prev.length}`, handle: d.handle, text: d.text, ts: d.ts },
            ])
          }
        } catch {
          // malformed message
        }
      }
    }

    ws.onclose = () => setStatus('disconnected')
    return () => ws.close()
  }, [token, channel])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function sendMessage() {
    if (!input.trim() || !wsRef.current || !channel || status !== 'connected') return
    const text = input.trim().slice(0, 500)
    wsRef.current.send(
      JSON.stringify({
        id: msgIdRef.current++,
        publish: {
          channel,
          data: { handle, text, ts: Date.now(), supporter: true },
        },
      }),
    )
    setInput('')
  }

  if (!token && !error) return null

  const liveMessages: LiveChatMessage[] = messages.map((m) => ({
    id: m.id,
    handle: m.handle,
    text: m.text,
    tone: 'supporter',
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
      error={error}
      readOnly={!token}
    />
  )
}
