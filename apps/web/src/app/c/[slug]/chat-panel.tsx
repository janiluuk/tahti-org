// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'

interface Announcement {
  id: string
  body: string
  createdAt: string
}

interface ChatMessage {
  id: string
  handle: string
  text: string
  ts: number
}

const HANDLE_KEY = 'tahti_chat_handle'

export default function ChatPanel({
  slug,
  announcements,
}: {
  slug: string
  announcements: Announcement[]
}) {
  const [handle, setHandle] = useState<string>('')
  const [pendingHandle, setPendingHandle] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [listenerCount, setListenerCount] = useState<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const msgIdRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load saved handle from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(HANDLE_KEY)
    if (saved) setHandle(saved)
  }, [])

  // Poll listener count every 30s
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/channels/${slug}/presence`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { numClients: number }
        setListenerCount(data.numClients)
      } catch {
        // ignore — presence is best-effort
      }
    }
    void poll()
    const t = setInterval(() => void poll(), 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [slug])

  // Connect to Centrifugo when we have a token
  useEffect(() => {
    if (!token) return
    const wsUrl =
      process.env.NEXT_PUBLIC_CENTRIFUGO_WS ?? 'ws://localhost:8000/connection/websocket'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => {
      // Send connect command with token
      ws.send(
        JSON.stringify({
          id: msgIdRef.current++,
          connect: { token },
        }),
      )
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as {
          id?: number
          connect?: { client: string }
          push?: { channel?: string; pub?: { data: unknown } }
        }

        if (data.connect) {
          // Connected — subscribe to channel
          ws.send(
            JSON.stringify({
              id: msgIdRef.current++,
              subscribe: { channel: `channel:${slug}` },
            }),
          )
          setStatus('connected')
        }

        if (data.push?.pub) {
          const msg = data.push.pub.data as { handle?: string; text?: string; ts?: number }
          if (msg.text) {
            const id = `${Date.now()}-${Math.random()}`
            setMessages((prev) =>
              [
                ...prev,
                { id, handle: msg.handle ?? 'anon', text: msg.text!, ts: msg.ts ?? Date.now() },
              ].slice(-100),
            )
          }
        }
      } catch {
        // malformed message
      }
    }

    ws.onerror = () => setError('Connection error')
    ws.onclose = () => setStatus('disconnected')

    return () => ws.close()
  }, [token, slug])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function joinChat(h: string) {
    try {
      const res = await fetch(`/api/chat/${slug}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: h }),
      })
      if (res.status === 403) {
        setError('You are banned from this channel.')
        return
      }
      if (!res.ok) throw new Error('Failed to get token')
      const data = (await res.json()) as { token: string; handle: string }
      localStorage.setItem(HANDLE_KEY, data.handle)
      setHandle(data.handle)
      setToken(data.token)
    } catch {
      setError('Could not join chat. Try again.')
    }
  }

  function sendMessage() {
    if (!input.trim() || !wsRef.current || status !== 'connected') return
    const text = input.trim().slice(0, 500)
    wsRef.current.send(
      JSON.stringify({
        id: msgIdRef.current++,
        publish: {
          channel: `channel:${slug}`,
          data: { handle, text, ts: Date.now() },
        },
      }),
    )
    setInput('')
  }

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #eee',
        borderRadius: 8,
        height: 'calc(100vh - 6rem)',
        position: 'sticky',
        top: '1rem',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #eee',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        Chat
        {status === 'connected' && (
          <span
            style={{
              fontSize: '0.7rem',
              background: '#16a34a',
              color: '#fff',
              padding: '0.1rem 0.4rem',
              borderRadius: 3,
            }}
          >
            live
          </span>
        )}
        {listenerCount !== null && listenerCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#888', fontWeight: 400 }}>
            {listenerCount} {listenerCount === 1 ? 'listener' : 'listeners'}
          </span>
        )}
      </div>

      {/* Pinned announcements */}
      {announcements.length > 0 && (
        <div style={{ borderBottom: '1px solid #f0f0f0' }}>
          {announcements.map((a) => (
            <div
              key={a.id}
              style={{
                padding: '0.6rem 1rem',
                background: '#fffbeb',
                borderLeft: '3px solid #f59e0b',
                fontSize: '0.85rem',
              }}
            >
              {a.body}
            </div>
          ))}
        </div>
      )}

      {/* Message list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
        {messages.length === 0 && status !== 'connected' && (
          <p style={{ color: '#aaa', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
            channel is quiet right now — say hi
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: '#555' }}>{m.handle}</span>
            <span style={{ color: '#333', marginLeft: '0.4rem' }}>{m.text}</span>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '0.5rem 1rem',
            background: '#fef2f2',
            color: '#dc2626',
            fontSize: '0.8rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Join / send area */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #eee' }}>
        {!token ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder="Your handle"
              value={pendingHandle}
              onChange={(e) => setPendingHandle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void joinChat(pendingHandle)
              }}
              maxLength={32}
              style={{
                flex: 1,
                padding: '0.4rem 0.6rem',
                border: '1px solid #ccc',
                borderRadius: 4,
                fontSize: '0.85rem',
              }}
            />
            <button
              onClick={() => void joinChat(pendingHandle)}
              style={{
                padding: '0.4rem 0.8rem',
                background: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Join
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder="Say something…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage()
              }}
              maxLength={500}
              disabled={status !== 'connected'}
              style={{
                flex: 1,
                padding: '0.4rem 0.6rem',
                border: '1px solid #ccc',
                borderRadius: 4,
                fontSize: '0.85rem',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={status !== 'connected'}
              style={{
                padding: '0.4rem 0.8rem',
                background: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: status === 'connected' ? 'pointer' : 'not-allowed',
                opacity: status === 'connected' ? 1 : 0.5,
                fontSize: '0.85rem',
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
