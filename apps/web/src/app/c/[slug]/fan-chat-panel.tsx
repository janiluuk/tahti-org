// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'

interface ChatMessage {
  id: string
  handle: string
  text: string
  ts: number
}

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
      const access = await fetch(`/api/chat/${slug}/access`, { credentials: 'include' })
      if (!access.ok || cancelled) return
      const data = (await access.json()) as { canJoinFanChat?: boolean }
      if (!data.canJoinFanChat) return

      const res = await fetch(`/api/chat/${slug}/fan-token`, {
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
      ws.send(
        JSON.stringify({
          id: 1,
          connect: { token, name: 'js' },
        }),
      )
    }

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as {
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

  return (
    <section className="ch-chat-panel" style={{ height: 'auto', position: 'static', marginTop: 0 }}>
      <div className="ch-chat-panel__head">
        <h4>FAN CHAT</h4>
        {status === 'connected' && <span className="ch-chat-live-badge">live</span>}
      </div>
      {error && <div className="ch-chat-error">{error}</div>}
      {token && (
        <>
          <div ref={scrollRef} className="ch-chat-messages" style={{ maxHeight: 180 }}>
            {messages.map((m) => (
              <div key={m.id} className="chat-msg">
                <span className="handle supporter">{m.handle}</span>
                <span className="text">{m.text}</span>
              </div>
            ))}
          </div>
          <div className="ch-chat-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Fans only…"
              maxLength={500}
            />
            <button type="button" className="ch-chat-send" onClick={sendMessage}>
              Send
            </button>
          </div>
        </>
      )}
    </section>
  )
}
