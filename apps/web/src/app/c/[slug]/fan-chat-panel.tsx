// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

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
    <section
      style={{
        marginTop: '1rem',
        border: '1px solid #e0e7ff',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#f8fafc',
      }}
    >
      <div style={{ padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.9rem' }}>
        Fan chat
        {status === 'connected' && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#16a34a' }}>live</span>
        )}
      </div>
      {error && (
        <p style={{ padding: '0.5rem 1rem', color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>
          {error}
        </p>
      )}
      {token && (
        <>
          <div
            ref={scrollRef}
            style={{ maxHeight: 180, overflowY: 'auto', padding: '0.5rem 1rem' }}
          >
            {messages.map((m) => (
              <div key={m.id} style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 600 }}>{m.handle}</span>
                <span style={{ marginLeft: '0.35rem' }}>{m.text}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              padding: '0.6rem 1rem',
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Fans only…"
              maxLength={500}
              style={{
                flex: 1,
                padding: '0.35rem 0.5rem',
                borderRadius: 4,
                border: '1px solid #ccc',
              }}
            />
            <button type="button" onClick={sendMessage} style={{ padding: '0.35rem 0.75rem' }}>
              Send
            </button>
          </div>
        </>
      )}
    </section>
  )
}
